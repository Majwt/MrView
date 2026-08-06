using Api.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Api.Database;

public class DashboardReadRepository : IDashboardReadRepository
{
    private readonly string _connectionString;
    private readonly TableIdentifier _nodesTable;
    private readonly TableIdentifier _edgesTable;
    private readonly TableIdentifier _edgeStatsView;
    private readonly TableIdentifier _portsTable;
    private readonly int _seenCountThreshold;

    public DashboardReadRepository(IConfiguration configuration, IOptions<DatabaseOptions> options)
    {
        _connectionString = configuration.GetConnectionString(Config.CONNECTION_STRING_NAME)
            ?? throw new InvalidOperationException("Missing connection string.");

        var dbOptions = options.Value;
        _nodesTable = TableIdentifier.Parse(dbOptions.NodeTable);
        _edgesTable = TableIdentifier.Parse(dbOptions.EdgeTable);
        _edgeStatsView = TableIdentifier.Parse(dbOptions.EdgeStatsView);
        _portsTable = TableIdentifier.Parse(dbOptions.PortsTable);
        _seenCountThreshold = dbOptions.SeenCountThreshold;
    }

    private static DateTime EnsureUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }

    public async Task<DashboardStats> GetDashboardStatsAsync(int customerId = -1)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        string sql;
        if (customerId == -1)
        {
            sql = $"""
                SELECT
                    total_edges           = COUNT_BIG(*),
                    active_nodes          = (SELECT COUNT_BIG(*) FROM {_nodesTable} WHERE last_seen >= DATEADD(DAY, -7, GETUTCDATE())),
                    total_seen_count      = ISNULL(SUM(seen_count), 0),
                    new_edges_last_7_days = COUNT_BIG(CASE WHEN first_seen >= DATEADD(DAY, -7, GETUTCDATE()) THEN 1 END)
                FROM {_edgeStatsView};
                """;
        }
        else
        {
            sql = $"""
                WITH customer_edges AS (
                    SELECT e.seen_count, e.first_seen
                    FROM {_edgeStatsView} e
                    LEFT JOIN {_nodesTable} na ON na.ciid = e.endpoint_a_ciid
                    LEFT JOIN {_nodesTable} nb ON nb.ciid = e.endpoint_b_ciid
                    WHERE na.group_id = @CustomerId OR nb.group_id = @CustomerId
                )
                SELECT
                    total_edges           = COUNT_BIG(*),
                    active_nodes          = (SELECT COUNT_BIG(*) FROM {_nodesTable} WHERE last_seen >= DATEADD(DAY, -7, GETUTCDATE()) AND group_id = @CustomerId),
                    total_seen_count      = ISNULL(SUM(seen_count), 0),
                    new_edges_last_7_days = COUNT_BIG(CASE WHEN first_seen >= DATEADD(DAY, -7, GETUTCDATE()) THEN 1 END)
                FROM customer_edges;
                """;
        }

        await using var command = new SqlCommand(sql, connection);
        if (customerId != -1)
        {
            command.Parameters.AddWithValue("@CustomerId", customerId);
        }

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();

        return new DashboardStats(
            TotalEdges: reader.GetInt64(reader.GetOrdinal("total_edges")),
            ActiveNodes: reader.GetInt64(reader.GetOrdinal("active_nodes")),
            TotalSeenCount: reader.GetInt64(reader.GetOrdinal("total_seen_count")),
            NewEdgesLast7Days: reader.GetInt64(reader.GetOrdinal("new_edges_last_7_days"))
        );
    }

    public async Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var customerJoin = customerId != -1
            ? $"LEFT JOIN {_nodesTable} na ON na.ciid = e.endpoint_a_ciid LEFT JOIN {_nodesTable} nb ON nb.ciid = e.endpoint_b_ciid"
            : "";
        var customerFilter = customerId != -1
            ? "AND (na.group_id = @CustomerId OR nb.group_id = @CustomerId)"
            : "";

        var sql = $"""
            SELECT
                date = e.observed_date,
                total_connections = COUNT_BIG(*),
                distinct_connections = COUNT_BIG(DISTINCT e.edge_key)
            FROM {_edgesTable} e
            {customerJoin}
            WHERE e.observed_date >= CAST(DATEADD(DAY, -@Days, GETUTCDATE()) AS date)
              {customerFilter}
            GROUP BY e.observed_date
            ORDER BY e.observed_date ASC;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Days", days);
        if (customerId != -1)
        {
            command.Parameters.AddWithValue("@CustomerId", customerId);
        }

        await using var reader = await command.ExecuteReaderAsync();

        var points = new List<ConnectionHistoryPoint>();
        var dateOrdinal = reader.GetOrdinal("date");
        var totalOrdinal = reader.GetOrdinal("total_connections");
        var distinctOrdinal = reader.GetOrdinal("distinct_connections");

        while (await reader.ReadAsync())
        {
            points.Add(new ConnectionHistoryPoint(
                Date: EnsureUtc(reader.GetDateTime(dateOrdinal)),
                TotalConnections: reader.GetInt64(totalOrdinal),
                DistinctConnections: reader.GetInt64(distinctOrdinal)
            ));
        }

        return points;
    }

    public async Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var customerJoin = customerId != -1
            ? $"LEFT JOIN {_nodesTable} na ON na.ciid = e.endpoint_a_ciid LEFT JOIN {_nodesTable} nb ON nb.ciid = e.endpoint_b_ciid"
            : "";
        var customerFilter = customerId != -1
            ? "AND (na.group_id = @CustomerId OR nb.group_id = @CustomerId)"
            : "";

        var sql = $"""
            SELECT TOP (@Limit)
                e.edge_key,
                e.endpoint_a_fqdn,
                e.endpoint_b_fqdn,
                service_name = COALESCE(ps.service_name, 'Unknown'),
                e.service_port,
                e.protocol,
                e.seen_count,
                e.first_seen,
                e.last_seen
            FROM {_edgeStatsView} e
            OUTER APPLY (
                SELECT TOP (1) p.service_name
                FROM {_portsTable} p
                WHERE p.port_number = e.service_port
                  AND (p.protocol = e.protocol OR p.protocol = 'any')
                ORDER BY CASE WHEN p.protocol = e.protocol THEN 0 ELSE 1 END
            ) ps
            {customerJoin}
            WHERE 1=1 {customerFilter}
            ORDER BY e.seen_count DESC;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Limit", limit);
        if (customerId != -1)
        {
            command.Parameters.AddWithValue("@CustomerId", customerId);
        }

        await using var reader = await command.ExecuteReaderAsync();

        var rows = new List<ConnectionRow>();
        var edgeKeyOrdinal = reader.GetOrdinal("edge_key");
        var endpointAOrdinal = reader.GetOrdinal("endpoint_a_fqdn");
        var endpointBOrdinal = reader.GetOrdinal("endpoint_b_fqdn");
        var serviceNameOrdinal = reader.GetOrdinal("service_name");
        var servicePortOrdinal = reader.GetOrdinal("service_port");
        var protocolOrdinal = reader.GetOrdinal("protocol");
        var seenCountOrdinal = reader.GetOrdinal("seen_count");
        var firstSeenOrdinal = reader.GetOrdinal("first_seen");
        var lastSeenOrdinal = reader.GetOrdinal("last_seen");

        while (await reader.ReadAsync())
        {
            rows.Add(new ConnectionRow(
                EdgeKey: reader.GetString(edgeKeyOrdinal),
                EndpointA: reader.GetString(endpointAOrdinal),
                EndpointB: reader.GetString(endpointBOrdinal),
                ServiceName: reader.GetString(serviceNameOrdinal),
                ServicePort: reader.IsDBNull(servicePortOrdinal) ? null : reader.GetInt32(servicePortOrdinal),
                Protocol: reader.IsDBNull(protocolOrdinal) ? "unknown" : reader.GetString(protocolOrdinal),
                SeenCount: reader.GetInt64(seenCountOrdinal),
                FirstSeen: EnsureUtc(reader.GetDateTime(firstSeenOrdinal)),
                LastSeen: EnsureUtc(reader.GetDateTime(lastSeenOrdinal))
            ));
        }

        return rows;
    }

    public async Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var customerFilter = customerId != -1 ? "AND n.group_id = @CustomerId" : "";
        var customerEdgeAggFilter = customerId != -1
            ? $"AND EXISTS (SELECT 1 FROM {_nodesTable} nc WHERE nc.group_id = @CustomerId AND (nc.ciid = e.endpoint_a_ciid OR nc.ciid = e.endpoint_b_ciid))"
            : "";

        var sql = $"""
            WITH edge_agg AS (
                SELECT
                    node_ciid,
                    edge_count      = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT e.endpoint_a_ciid AS node_ciid, e.edge_key, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold
                      {customerEdgeAggFilter}

                    UNION ALL

                    SELECT e.endpoint_b_ciid AS node_ciid, e.edge_key, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold
                      AND e.endpoint_b_ciid <> e.endpoint_a_ciid
                      {customerEdgeAggFilter}
                ) x
                WHERE node_ciid IS NOT NULL
                GROUP BY node_ciid
            )
            SELECT TOP (@Limit)
                n.ciid,
                fqdn       = COALESCE(n.fqdn, n.ciid),
                hostname   = CASE
                                 WHEN CHARINDEX('.', COALESCE(n.fqdn, '')) > 0
                                 THEN LEFT(n.fqdn, CHARINDEX('.', n.fqdn) - 1)
                                 ELSE COALESCE(n.fqdn, n.ciid)
                             END,
                distinct_edges   = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0),
                n.os_version,
                n.client_name,
                n.client_version,
                n.first_seen,
                n.last_seen,
                group_name = COALESCE(n.group_name, '')
            FROM {_nodesTable} n
            LEFT JOIN edge_agg ea ON ea.node_ciid = n.ciid
            WHERE 1=1
              {customerFilter}
            ORDER BY connection_count DESC;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Limit", limit);
        command.Parameters.AddWithValue("@SeenCountThreshold", _seenCountThreshold);
        if (customerId != -1)
        {
            command.Parameters.AddWithValue("@CustomerId", customerId);
        }

        await using var reader = await command.ExecuteReaderAsync();

        var rows = new List<NodeRow>();
        var ciidOrdinal = reader.GetOrdinal("ciid");
        var fqdnOrdinal = reader.GetOrdinal("fqdn");
        var hostnameOrdinal = reader.GetOrdinal("hostname");
        var os_VersionOrdinal = reader.GetOrdinal("os_version");
        var clientNameOrdinal = reader.GetOrdinal("client_name");
        var clientVersionOrdinal = reader.GetOrdinal("client_version");
        var edgesOrdinal = reader.GetOrdinal("distinct_edges");
        var connectionOrdinal = reader.GetOrdinal("connection_count");
        var firstSeenOrdinal = reader.GetOrdinal("first_seen");
        var lastSeenOrdinal = reader.GetOrdinal("last_seen");
        var groupNameOrdinal = reader.GetOrdinal("group_name");

        while (await reader.ReadAsync())
        {
            rows.Add(new NodeRow(
                Ciid: reader.GetString(ciidOrdinal),
                Fqdn: reader.GetString(fqdnOrdinal),
                Os: reader.GetString(os_VersionOrdinal),
                Client: reader.GetString(clientNameOrdinal),
                ClientVersion: reader.GetString(clientVersionOrdinal),
                Hostname: reader.GetString(hostnameOrdinal),
                DistinctEdges: reader.GetInt64(edgesOrdinal),
                ConnectionCount: reader.GetInt64(connectionOrdinal),
                FirstSeen: EnsureUtc(reader.GetDateTime(firstSeenOrdinal)),
                LastSeen: EnsureUtc(reader.GetDateTime(lastSeenOrdinal)),
                GroupName: reader.GetString(groupNameOrdinal)
            ));
        }

        return rows;
    }
}
