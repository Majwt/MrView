using api;
using Microsoft.Data.SqlClient;
using System.Globalization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System
        .Text
        .Json
        .JsonNamingPolicy
        .SnakeCaseLower;
});
builder.Configuration.AddEnvironmentVariables();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

var configuredTableName =
    builder.Configuration["database:table_name"]
    ?? throw new InvalidOperationException(
        "Database table name is not configured! Change the 'database:table_name' setting in appsettings.json or set the environment variable 'DATABASE__TABLE_NAME'."
    );
var configuredSeenCountThreshold = builder.Configuration["database:seen_count_threshold"] ?? "0";
if (configuredSeenCountThreshold.Any(c => !char.IsDigit(c)))
{
    throw new InvalidOperationException(
        "Seen count threshold must be a non-negative integer. Change the 'data:seen_count_threshold' setting in appsettings.json or set the environment variable 'DATA__SEEN_COUNT_THRESHOLD' to a valid value."
    );
}
var safeTableName = QuoteMultipartIdentifier(configuredTableName);
var graphSelectSql = """
    SELECT id, endpoint_a, endpoint_b, service_port,
        pid, process_name, seen_count,
        source_fqdn, source_ip, source_port,
        source_pid, source_process_name,
        target_fqdn, target_ip, target_port,
        target_pid, target_process_name, last_seen
    """;
var graphSnapshotSql = $"""
    {graphSelectSql}
    FROM {safeTableName}
    WHERE seen_count > {configuredSeenCountThreshold}
    ORDER BY last_seen ASC, id ASC
    """;
var graphDeltaSql = $"""
    {graphSelectSql}
    FROM {safeTableName}
    WHERE seen_count > {configuredSeenCountThreshold}
        AND (
            last_seen > @since_last_seen
            OR (last_seen = @since_last_seen AND id > @since_row_id)
        )
    ORDER BY last_seen ASC, id ASC
    """;

app.MapGet("/", () => Results.Ok(new { status = "ok" }));

app.MapGet(
    "/api/graph/snapshot",
    async (CancellationToken cancellationToken) =>
    {
        var connectionString = builder.Configuration.GetConnectionString("Default");

        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(graphSnapshotSql, conn);
        var (nodes, edges, cursor) = await ReadGraphQueryAsync(cmd, cancellationToken);

        return Results.Ok(new GraphSnapshotResponse(nodes, edges, cursor));
    }
);

app.MapGet(
    "/api/graph",
    async (CancellationToken cancellationToken) =>
    {
        var connectionString = builder.Configuration.GetConnectionString("Default");

        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(graphSnapshotSql, conn);
        var (nodes, edges, _) = await ReadGraphQueryAsync(cmd, cancellationToken);
        return Results.Ok(new GraphResponse(nodes, edges));
    }
);

app.MapGet(
    "/api/graph/delta",
    async (HttpRequest request, CancellationToken cancellationToken) =>
    {
        var sinceLastSeenRaw = request.Query["since_last_seen"].ToString();
        var sinceRowIdRaw = request.Query["since_row_id"].ToString();

        if (!TryParseCursor(sinceLastSeenRaw, sinceRowIdRaw, out var sinceLastSeen, out var sinceRowId))
        {
            return Results.BadRequest(new
            {
                error = "Invalid cursor. Use since_last_seen (ISO datetime) and since_row_id (non-negative integer)."
            });
        }

        var connectionString = builder.Configuration.GetConnectionString("Default");
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(graphDeltaSql, conn);
        cmd.Parameters.Add(new SqlParameter("@since_last_seen", System.Data.SqlDbType.DateTime2) { Value = sinceLastSeen });
        cmd.Parameters.Add(new SqlParameter("@since_row_id", System.Data.SqlDbType.BigInt) { Value = sinceRowId });

        var (nodes, edges, cursor) = await ReadGraphQueryAsync(cmd, cancellationToken);
        if (edges.Count == 0)
        {
            cursor = new GraphCursor(sinceLastSeen, sinceRowId);
        }

        return Results.Ok(new GraphDeltaResponse(
            UpsertNodes: nodes,
            UpsertEdges: edges,
            RemoveNodeIds: [],
            RemoveEdgeIds: [],
            Cursor: cursor
        ));
    }
);

try
{
    app.Run();
}
catch (OperationCanceledException) { }

static bool TryParseCursor(string sinceLastSeenRaw, string sinceRowIdRaw, out DateTime sinceLastSeen, out long sinceRowId)
{
    var hasValidTimestamp = DateTime.TryParse(
        sinceLastSeenRaw,
        CultureInfo.InvariantCulture,
        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
        out sinceLastSeen
    );
    var hasValidRowId = long.TryParse(sinceRowIdRaw, out sinceRowId) && sinceRowId >= 0;
    return hasValidTimestamp && hasValidRowId;
}

static async Task<(List<Node> Nodes, List<Edge> Edges, GraphCursor Cursor)> ReadGraphQueryAsync(SqlCommand cmd, CancellationToken cancellationToken)
{
    var nodes = new List<Node>();
    var edges = new List<Edge>();
    var seenNodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var cursor = new GraphCursor(DateTime.MinValue, 0);

    await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        if (
            reader["source_fqdn"] is not string sourceFqdn
            || reader["source_ip"] is not string sourceIp
            || reader["target_fqdn"] is not string targetFqdn
            || reader["target_ip"] is not string targetIp
        )
        {
            continue;
        }

        var processName = reader["process_name"] as string;
        var pid = reader["pid"] == DBNull.Value ? -1 : Convert.ToInt32(reader["pid"]);
        var sourcePort = reader["source_port"] == DBNull.Value ? 0 : Convert.ToInt32(reader["source_port"]);
        var targetPort = reader["target_port"] == DBNull.Value ? 0 : Convert.ToInt32(reader["target_port"]);
        var seenCount = reader["seen_count"] == DBNull.Value ? 1 : Convert.ToInt64(reader["seen_count"]);
        var sourcePid = reader["source_pid"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["source_pid"]);
        var sourceProcessName = reader["source_process_name"] as string;
        var targetPid = reader["target_pid"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["target_pid"]);
        var targetProcessName = reader["target_process_name"] as string;
        var endpointA = reader["endpoint_a"] as string;
        var endpointB = reader["endpoint_b"] as string;
        var servicePort = reader["service_port"] == DBNull.Value ? "0" : Convert.ToInt32(reader["service_port"]).ToString();
        var stableEdgeId = endpointA is null || endpointB is null
            ? $"{sourceFqdn}:{sourcePort}->{targetFqdn}:{targetPort}"
            : $"{endpointA}|{endpointB}|{servicePort}";
        var lastSeen = reader["last_seen"] == DBNull.Value
            ? DateTime.MinValue
            : Convert.ToDateTime(reader["last_seen"]);
        var rowId = reader["id"] == DBNull.Value ? 0 : Convert.ToInt64(reader["id"]);

        if (seenNodes.Add(sourceFqdn))
        {
            nodes.Add(new Node(sourceFqdn, sourceIp));
        }

        if (seenNodes.Add(targetFqdn))
        {
            nodes.Add(new Node(targetFqdn, targetIp));
        }

        edges.Add(
            new Edge(
                Id: stableEdgeId,
                SourceIp: sourceIp,
                SourcePort: sourcePort,
                SourceFqdn: sourceFqdn,
                TargetIp: targetIp,
                TargetPort: targetPort,
                TargetFqdn: targetFqdn,
                Pid: pid,
                ProcessName: processName,
                SeenCount: seenCount,
                SourcePid: sourcePid,
                SourceProcessName: sourceProcessName,
                TargetPid: targetPid,
                TargetProcessName: targetProcessName,
                LastSeen: lastSeen
            )
        );

        cursor = new GraphCursor(lastSeen, rowId);
    }

    return (nodes, edges, cursor);
}

static string QuoteMultipartIdentifier(string configuredIdentifier)
{
    var parts = configuredIdentifier.Split('.', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    if (parts.Length is < 1 or > 3)
    {
        throw new InvalidOperationException(
            "Database table name is invalid. Use SQL identifiers in the format 'table', 'schema.table', or 'database.schema.table'."
        );
    }

    var quotedParts = new string[parts.Length];
    for (var i = 0; i < parts.Length; i++)
    {
        if (!IsSafeIdentifierPart(parts[i]))
        {
            throw new InvalidOperationException(
                $"Database table name contains an unsafe identifier part: '{parts[i]}'."
            );
        }

        quotedParts[i] = $"[{parts[i]}]";
    }

    return string.Join('.', quotedParts);
}

static bool IsSafeIdentifierPart(string value)
{
    if (value.Length is 0 or > 128)
    {
        return false;
    }

    if (!(char.IsLetter(value[0]) || value[0] == '_'))
    {
        return false;
    }

    for (var i = 1; i < value.Length; i++)
    {
        if (!(char.IsLetterOrDigit(value[i]) || value[i] == '_'))
        {
            return false;
        }
    }

    return true;
}
