using System.Text.RegularExpressions;
using Api.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Api.Database;

public class Db
{
    private readonly ILogger<Db> _logger;
    public string ConnectionString { get; }
    private readonly TableIdentifier _nodesTable;
    private readonly TableIdentifier _edgesTable;
    private int SeenCountThreshold { get; }

    public Db(IConfiguration configuration, IOptions<DatabaseOptions> options, ILogger<Db> logger)
    {
        _logger = logger;
        ConnectionString =
            configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Missing connection string.");

        var dbOptions = options.Value;

        _nodesTable = TableIdentifier.Parse(dbOptions.NodeTable);
        _edgesTable = TableIdentifier.Parse(dbOptions.EdgeTable);

        SeenCountThreshold = dbOptions.SeenCountThreshold;
    }

    private static bool IsValidIdentifier(string value)
    {
        return Regex.IsMatch(value, @"^[A-Za-z0-9_]+$");
    }

    private const string _edgesColumns =
        @"
        id,
        protocol,
        service_port,
        service_name,

        seen_count,

        source_fqdn,
        source_ip,
        source_port,
        source_process_name,
        source_pid,

        target_fqdn,
        target_ip,
        target_port,
        target_process_name,
        target_pid,

        first_seen,
        last_seen
          ";

    public async Task<IEnumerable<EdgeDto>> getEdgesAsync(GraphCursor cursor)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            SELECT
              {_edgesColumns}
            FROM {_nodesTable.Schema}.{_nodesTable.Table}
              WHERE last_seen > @LastSeen
                 OR id > @LastId
              ORDER BY last_seen, id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@LastSeen", cursor.LastSeen);
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseEdgesFromReader(reader);
    }

    private static async Task<IEnumerable<EdgeDto>> ParseEdgesFromReader(SqlDataReader reader)
    {
        var edges = new List<EdgeDto>();
        while (await reader.ReadAsync())
        {
            var edge = new EdgeDto(
                Id: reader.GetString(reader.GetOrdinal("id")),
                Protocol: reader.GetString(reader.GetOrdinal("protocol")),
                ServiceName: reader.GetString(reader.GetOrdinal("service_name")),
                SourceIp: reader.GetString(reader.GetOrdinal("source_ip")),
                SourcePort: reader.IsDBNull(reader.GetOrdinal("source_port"))
                    ? null
                    : reader.GetInt32(reader.GetOrdinal("source_port")),
                SourceFqdn: reader.GetString(reader.GetOrdinal("source_fqdn")),
                SourcePid: reader.IsDBNull(reader.GetOrdinal("source_pid"))
                    ? null
                    : (int?)reader.GetInt32(reader.GetOrdinal("source_pid")),
                SourceProcessName: reader.IsDBNull(reader.GetOrdinal("source_process_name"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("source_process_name")),
                TargetIp: reader.GetString(reader.GetOrdinal("target_ip")),
                TargetPort: reader.IsDBNull(reader.GetOrdinal("target_port"))
                    ? null
                    : reader.GetInt32(reader.GetOrdinal("target_port")),
                TargetFqdn: reader.GetString(reader.GetOrdinal("target_fqdn")),
                TargetPid: reader.IsDBNull(reader.GetOrdinal("target_pid"))
                    ? null
                    : (int?)reader.GetInt32(reader.GetOrdinal("target_pid")),
                TargetProcessName: reader.IsDBNull(reader.GetOrdinal("target_process_name"))
                    ? null
                    : reader.GetString(reader.GetOrdinal("target_process_name")),
                SeenCount: reader.GetInt64(reader.GetOrdinal("seen_count")),
                LastSeen: reader.GetDateTime(reader.GetOrdinal("last_seen")),
                FirstSeen: reader.GetDateTime(reader.GetOrdinal("first_seen"))
            );
            edges.Add(edge);
        }
        return edges;
    }

    private const string _nodesColumns =
        @"
        Id,
        Fqdn,
        Hostname,
        InterfacesJson,
        CmdbCiId,
        Customer,
        CustomerID,
        UniqueEdges,
        ConnectionCount,
        FirstSeen,
        LastSeen
          ";

    public async Task<IEnumerable<NodeDto>> getNodesAsync(GraphCursor cursor)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
                SELECT
                {_nodesColumns}
                FROM {_edgesTable.Schema}.{_edgesTable.Table}
                WHERE
                    LastSeen > @LastSeen
                    OR (
                        LastSeen = @LastSeen
                        AND Id > @LastId
                    )
                ORDER BY LastSeen, Id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@LastSeen", cursor.LastSeen);
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseNodesFromReader(reader);
    }

    private static async Task<IEnumerable<NodeDto>> ParseNodesFromReader(SqlDataReader reader)
    {
        var nodes = new List<NodeDto>();
        while (await reader.ReadAsync())
        {
            var interfacesJson = reader.GetString(reader.GetOrdinal("InterfacesJson"));
            var interfaces = System.Text.Json.JsonSerializer.Deserialize<List<Interface>>(
                interfacesJson
            );
            if (interfaces == null || interfaces.Count == 0)
            {
                continue;
            }
            var node = new NodeDto(
                Fqdn: reader.GetString(reader.GetOrdinal("Fqdn")),
                Ip: reader.GetString(reader.GetOrdinal("Hostname")),
                Interfaces: interfaces,
                DistinctEdge: reader.GetInt32(reader.GetOrdinal("DistinctEdges")),
                ConnectionCount: reader.GetInt32(reader.GetOrdinal("ConnectionCount")),
                Customer: new Customer(
                    Name: reader.GetString(reader.GetOrdinal("Customer")),
                    CmdbCiId: reader.GetString(reader.GetOrdinal("CmdbCiId")),
                    Id: reader.GetInt32(reader.GetOrdinal("CustomerID"))
                ),
                FirstSeen: reader.GetDateTime(reader.GetOrdinal("FirstSeen")),
                LastSeen: reader.GetDateTime(reader.GetOrdinal("LastSeen"))
            );
            nodes.Add(node);
        }
        return nodes;
    }

    public void getCustomerGraphSnapshot(int customerId)
    {
        // Similar to getGraphSnapshot but with a WHERE clause for the specific customer
    }

    public void getCustomerGraphDelta(int customerId, DateTime sinceLastSeen, long sinceRowId)
    {
        // Similar to getGraphDelta but with a WHERE clause for the specific customer
    }
}

public sealed partial record TableIdentifier(string Schema, string Table)
{
    [GeneratedRegex(
        @"^(?:\[([A-Za-z0-9]+)\]|([A-Za-z0-9]+))\.(?:\[([A-Za-z0-9]+)\]|([A-Za-z0-9]+))$"
    )]
    private static partial Regex TableRegex();

    public static TableIdentifier Parse(string input)
    {
        var match = TableRegex().Match(input);

        if (!match.Success)
        {
            throw new InvalidOperationException($"Invalid table identifier '{input}'.");
        }

        var schema = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;

        var table = match.Groups[3].Success ? match.Groups[3].Value : match.Groups[4].Value;

        return new TableIdentifier(schema, table);
    }

    public static bool TryParse(string input, out TableIdentifier? result)
    {
        var match = TableRegex().Match(input);

        if (!match.Success)
        {
            result = null;
            return false;
        }

        var schema = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;

        var table = match.Groups[3].Success ? match.Groups[3].Value : match.Groups[4].Value;

        result = new TableIdentifier(schema, table);
        return true;
    }

    public override string ToString()
    {
        return $"[{Schema}].[{Table}]";
    }
}
