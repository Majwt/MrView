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
    private readonly TableIdentifier _edgeStatsView;
    private readonly TableIdentifier _interfacesTable;
    private readonly TableIdentifier _portsTable;
    private int SeenCountThreshold { get; }

    public Db(IConfiguration configuration, IOptions<DatabaseOptions> options, ILogger<Db> logger)
    {
        _logger = logger;
        ConnectionString =
            configuration.GetConnectionString(Config.CONNECTION_STRING_NAME)
            ?? throw new InvalidOperationException("Missing connection string.");

        var dbOptions = options.Value;

        _nodesTable = TableIdentifier.Parse(dbOptions.NodeTable);
        _edgesTable = TableIdentifier.Parse(dbOptions.EdgeTable);
        _edgeStatsView = TableIdentifier.Parse(dbOptions.EdgeStatsView);
        _interfacesTable = TableIdentifier.Parse(dbOptions.InterfaceTable);
        _portsTable = TableIdentifier.Parse(dbOptions.PortsTable);

        SeenCountThreshold = dbOptions.SeenCountThreshold;
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

    private static string HostnameFromFqdn(string fqdn)
    {
        var idx = fqdn.IndexOf('.');
        return idx > 0 ? fqdn[..idx] : fqdn;
    }

    private static long StableNodeId(string serverId)
    {
        unchecked
        {
            long hash = 1469598103934665603;
            foreach (var c in serverId)
            {
                hash ^= c;
                hash *= 1099511628211;
            }
            return hash < 0 ? -hash : hash;
        }
    }

    public async Task<IEnumerable<EdgeEntity>> getEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var activeFilter = queryParams.ManagedOnly
            ? "AND e.endpoint_a_ciid IS NOT NULL AND e.endpoint_b_ciid IS NOT NULL"
            : "";
        var staleEdgeFilter = queryParams.MinLastSeenHours.HasValue ? "AND e.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var sql = $"""
            SELECT
                e.id,
                endpoint_a_fqdn = COALESCE(na.fqdn, e.endpoint_a_fqdn),
                endpoint_b_fqdn = COALESCE(nb.fqdn, e.endpoint_b_fqdn),
                e.endpoint_a_ipv4,
                e.endpoint_b_ipv4,
                e.endpoint_a_port,
                e.endpoint_b_port,
                e.endpoint_a_process_id,
                e.endpoint_b_process_id,
                e.endpoint_a_process_name,
                e.endpoint_b_process_name,
                e.service_port,
                service_name = COALESCE(ps.service_name, 'Unknown'),
                e.seen_count,
                e.first_seen,
                e.last_seen,
                e.edge_key
            FROM {_edgeStatsView} e
            LEFT JOIN {_nodesTable} na
                ON na.ciid = e.endpoint_a_ciid
            LEFT JOIN {_nodesTable} nb
                ON nb.ciid = e.endpoint_b_ciid
            OUTER APPLY (
                SELECT TOP (1)
                    p.service_name
                FROM {_portsTable} p
                WHERE p.port_number = e.service_port
                  AND (p.protocol = e.protocol OR p.protocol = 'any')
                ORDER BY CASE WHEN p.protocol = e.protocol THEN 0 ELSE 1 END
            ) ps
            WHERE e.seen_count > @SeenCountThreshold
              {activeFilter}
              {staleEdgeFilter}
              AND (
                    e.last_seen > @LastSeen
                    OR (
                        e.last_seen = @LastSeen
                        AND e.id > @LastId
                    )
              )
            ORDER BY e.last_seen, e.id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseEdgesFromReader(reader);
    }

    public async Task<IEnumerable<EdgeEntity>> getCustomerEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var activeFilter = queryParams.ManagedOnly
            ? "AND e.endpoint_a_ciid IS NOT NULL AND e.endpoint_b_ciid IS NOT NULL"
            : "";
        var staleEdgeFilter = queryParams.MinLastSeenHours.HasValue ? "AND e.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var sql = $"""
            SELECT
                e.id,
                endpoint_a_fqdn = COALESCE(na.fqdn, e.endpoint_a_fqdn),
                endpoint_b_fqdn = COALESCE(nb.fqdn, e.endpoint_b_fqdn),
                e.endpoint_a_ipv4,
                e.endpoint_b_ipv4,
                e.endpoint_a_port,
                e.endpoint_b_port,
                e.endpoint_a_process_id,
                e.endpoint_b_process_id,
                e.endpoint_a_process_name,
                e.endpoint_b_process_name,
                e.service_port,
                service_name = COALESCE(ps.service_name, 'Unknown'),
                e.seen_count,
                e.first_seen,
                e.last_seen,
                e.edge_key
            FROM {_edgeStatsView} e
            OUTER APPLY (
                SELECT TOP (1)
                    p.service_name
                FROM {_portsTable} p
                WHERE p.port_number = e.service_port
                  AND (p.protocol = e.protocol OR p.protocol = 'any')
                ORDER BY CASE WHEN p.protocol = e.protocol THEN 0 ELSE 1 END
            ) ps
            LEFT JOIN {_nodesTable} na
                ON na.ciid = e.endpoint_a_ciid
            LEFT JOIN {_nodesTable} nb
                ON nb.ciid = e.endpoint_b_ciid
            WHERE e.seen_count > @SeenCountThreshold
              AND (
                    na.group_id = @CustomerId
                    OR nb.group_id = @CustomerId
              )
              {activeFilter}
              {staleEdgeFilter}
              AND (
                    e.last_seen > @LastSeen
                    OR (
                        e.last_seen = @LastSeen
                        AND e.id > @LastId
                    )
              )
            ORDER BY e.last_seen, e.id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseEdgesFromReader(reader);
    }

    // Returns one row per directed fqdn→fqdn pair. Cursor is based on MIN(first_seen) per pair.
    public async Task<IEnumerable<EdgeEntity>> getDistinctEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var activeFilter = queryParams.ManagedOnly
            ? "AND e.endpoint_a_ciid IS NOT NULL AND e.endpoint_b_ciid IS NOT NULL"
            : "";
        var staleEdgeFilter = queryParams.MinLastSeenHours.HasValue ? "AND e.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var sql = $"""
            WITH base AS (
                SELECT
                    e.id,
                    a_fqdn = COALESCE(na.fqdn, e.endpoint_a_fqdn),
                    b_fqdn = COALESCE(nb.fqdn, e.endpoint_b_fqdn),
                    e.endpoint_a_ipv4,
                    e.endpoint_b_ipv4,
                    e.seen_count,
                    e.first_seen
                FROM {_edgeStatsView} e
                LEFT JOIN {_nodesTable} na ON na.ciid = e.endpoint_a_ciid
                LEFT JOIN {_nodesTable} nb ON nb.ciid = e.endpoint_b_ciid
                WHERE e.seen_count > @SeenCountThreshold
                  {activeFilter}
                  {staleEdgeFilter}
            )
            SELECT
                id                      = MAX(b.id),
                endpoint_a_fqdn         = b.a_fqdn,
                endpoint_b_fqdn         = b.b_fqdn,
                endpoint_a_ipv4         = MIN(b.endpoint_a_ipv4),
                endpoint_b_ipv4         = MIN(b.endpoint_b_ipv4),
                endpoint_a_port         = CAST(NULL AS int),
                endpoint_b_port         = CAST(NULL AS int),
                endpoint_a_process_id   = CAST(NULL AS int),
                endpoint_b_process_id   = CAST(NULL AS int),
                endpoint_a_process_name = CAST(NULL AS nvarchar(260)),
                endpoint_b_process_name = CAST(NULL AS nvarchar(260)),
                service_port            = CAST(NULL AS int),
                service_name            = CAST(NULL AS nvarchar(100)),
                seen_count              = SUM(b.seen_count),
                first_seen              = MIN(b.first_seen),
                last_seen               = MIN(b.first_seen),
                edge_key                = CONVERT(nvarchar(64), HASHBYTES('SHA2_256',
                                              LOWER(b.a_fqdn) + '|' + LOWER(b.b_fqdn)
                                          ), 2)
            FROM base b
            GROUP BY b.a_fqdn, b.b_fqdn
            HAVING
                MIN(b.first_seen) > @LastSeen
                OR (MIN(b.first_seen) = @LastSeen AND MAX(b.id) > @LastId)
            ORDER BY MIN(b.first_seen), MAX(b.id);
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseEdgesFromReader(reader);
    }

    public async Task<IEnumerable<EdgeEntity>> getCustomerDistinctEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var activeFilter = queryParams.ManagedOnly
            ? "AND e.endpoint_a_ciid IS NOT NULL AND e.endpoint_b_ciid IS NOT NULL"
            : "";
        var staleEdgeFilter = queryParams.MinLastSeenHours.HasValue ? "AND e.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var sql = $"""
            WITH base AS (
                SELECT
                    e.id,
                    a_fqdn = COALESCE(na.fqdn, e.endpoint_a_fqdn),
                    b_fqdn = COALESCE(nb.fqdn, e.endpoint_b_fqdn),
                    e.endpoint_a_ipv4,
                    e.endpoint_b_ipv4,
                    e.seen_count,
                    e.first_seen
                FROM {_edgeStatsView} e
                LEFT JOIN {_nodesTable} na ON na.ciid = e.endpoint_a_ciid
                LEFT JOIN {_nodesTable} nb ON nb.ciid = e.endpoint_b_ciid
                WHERE e.seen_count > @SeenCountThreshold
                  AND (na.group_id = @CustomerId OR nb.group_id = @CustomerId)
                  {activeFilter}
                  {staleEdgeFilter}
            )
            SELECT
                id                      = MAX(b.id),
                endpoint_a_fqdn         = b.a_fqdn,
                endpoint_b_fqdn         = b.b_fqdn,
                endpoint_a_ipv4         = MIN(b.endpoint_a_ipv4),
                endpoint_b_ipv4         = MIN(b.endpoint_b_ipv4),
                endpoint_a_port         = CAST(NULL AS int),
                endpoint_b_port         = CAST(NULL AS int),
                endpoint_a_process_id   = CAST(NULL AS int),
                endpoint_b_process_id   = CAST(NULL AS int),
                endpoint_a_process_name = CAST(NULL AS nvarchar(260)),
                endpoint_b_process_name = CAST(NULL AS nvarchar(260)),
                service_port            = CAST(NULL AS int),
                service_name            = CAST(NULL AS nvarchar(100)),
                seen_count              = SUM(b.seen_count),
                first_seen              = MIN(b.first_seen),
                last_seen               = MIN(b.first_seen),
                edge_key                = CONVERT(nvarchar(64), HASHBYTES('SHA2_256',
                                              LOWER(b.a_fqdn) + '|' + LOWER(b.b_fqdn)
                                          ), 2)
            FROM base b
            GROUP BY b.a_fqdn, b.b_fqdn
            HAVING
                MIN(b.first_seen) > @LastSeen
                OR (MIN(b.first_seen) = @LastSeen AND MAX(b.id) > @LastId)
            ORDER BY MIN(b.first_seen), MAX(b.id);
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseEdgesFromReader(reader);
    }

    private async Task<IEnumerable<EdgeEntity>> ParseEdgesFromReader(SqlDataReader reader)
    {
        var edges = new List<EdgeEntity>();

        var idOrdinal = reader.GetOrdinal("id");
        var endpointAFqdnOrdinal = reader.GetOrdinal("endpoint_a_fqdn");
        var endpointBFqdnOrdinal = reader.GetOrdinal("endpoint_b_fqdn");
        var endpointAIpOrdinal = reader.GetOrdinal("endpoint_a_ipv4");
        var endpointBIpOrdinal = reader.GetOrdinal("endpoint_b_ipv4");
        var endpointAPortOrdinal = reader.GetOrdinal("endpoint_a_port");
        var endpointBPortOrdinal = reader.GetOrdinal("endpoint_b_port");
        var endpointAPidOrdinal = reader.GetOrdinal("endpoint_a_process_id");
        var endpointBPidOrdinal = reader.GetOrdinal("endpoint_b_process_id");
        var endpointAProcessOrdinal = reader.GetOrdinal("endpoint_a_process_name");
        var endpointBProcessOrdinal = reader.GetOrdinal("endpoint_b_process_name");
        var servicePortOrdinal = reader.GetOrdinal("service_port");
        var serviceNameOrdinal = reader.GetOrdinal("service_name");
        var seenCountOrdinal = reader.GetOrdinal("seen_count");
        var firstSeenOrdinal = reader.GetOrdinal("first_seen");
        var lastSeenOrdinal = reader.GetOrdinal("last_seen");
        var edgeKeyOrdinal = reader.GetOrdinal("edge_key");

        while (await reader.ReadAsync())
        {
            var id = reader.GetInt64(idOrdinal);
            var sourceFqdn = reader.GetString(endpointAFqdnOrdinal);
            var targetFqdn = reader.GetString(endpointBFqdnOrdinal);
            var sourceIp = reader.GetString(endpointAIpOrdinal);
            var targetIp = reader.GetString(endpointBIpOrdinal);
            var sourcePort = reader.IsDBNull(endpointAPortOrdinal)
                ? null
                : (long?)reader.GetInt32(endpointAPortOrdinal);
            var targetPort = reader.IsDBNull(endpointBPortOrdinal)
                ? null
                : (long?)reader.GetInt32(endpointBPortOrdinal);

            var sourcePid = reader.IsDBNull(endpointAPidOrdinal)
                ? null
                : (long?)reader.GetInt32(endpointAPidOrdinal);
            var targetPid = reader.IsDBNull(endpointBPidOrdinal)
                ? null
                : (long?)reader.GetInt32(endpointBPidOrdinal);

            var sourceProcessName = reader.IsDBNull(endpointAProcessOrdinal)
                ? null
                : reader.GetString(endpointAProcessOrdinal);
            var targetProcessName = reader.IsDBNull(endpointBProcessOrdinal)
                ? null
                : reader.GetString(endpointBProcessOrdinal);

            var servicePort = reader.IsDBNull(servicePortOrdinal)
                ? null
                : (int?)reader.GetInt32(servicePortOrdinal);
            var serviceName = reader.IsDBNull(serviceNameOrdinal)
                ? "Unknown"
                : reader.GetString(serviceNameOrdinal);

            var seenCount = reader.GetInt64(seenCountOrdinal);
            var firstSeen = EnsureUtc(reader.GetDateTime(firstSeenOrdinal));
            var lastSeen = EnsureUtc(reader.GetDateTime(lastSeenOrdinal));
            var edgeKey = reader.GetString(edgeKeyOrdinal);

            edges.Add(
                new EdgeEntity(
                    Id: id,
                    EndpointA: sourceFqdn,
                    EndpointB: targetFqdn,
                    ServiceFqdn: targetFqdn,
                    ServicePort: servicePort,
                    ServiceName: serviceName,
                    SourceIp: sourceIp,
                    SourcePort: sourcePort,
                    SourceFqdn: sourceFqdn,
                    SourcePid: sourcePid,
                    SourceProcessName: sourceProcessName,
                    TargetIp: targetIp,
                    TargetPort: targetPort,
                    TargetFqdn: targetFqdn,
                    TargetPid: targetPid,
                    TargetProcessName: targetProcessName,
                    SeenCount: seenCount,
                    LastSeen: lastSeen,
                    FirstSeen: firstSeen,
                    EdgeKey: edgeKey
                )
            );
        }

        return edges;
    }

    public async Task<IEnumerable<NodeSummaryEntity>> getNodeSummariesAsync(GraphCursor cursor, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var isolatedFilter = queryParams.ExcludeIsolated ? "AND COALESCE(ea.edge_count, 0) > 0" : "";
        var staleFilter = queryParams.MinLastSeenHours.HasValue ? "AND n.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var managedHavingFilter = queryParams.ManagedOnly ? "AND MAX(e.endpoint_a_ciid) IS NOT NULL AND MAX(e.endpoint_b_ciid) IS NOT NULL" : "";

        var sql = $"""
            WITH edge_base AS (
                SELECT
                    endpoint_a_ciid = MAX(e.endpoint_a_ciid),
                    endpoint_b_ciid = MAX(e.endpoint_b_ciid),
                    seen_count      = COUNT_BIG(*)
                FROM {_edgesTable} e
                GROUP BY e.edge_key
                HAVING COUNT_BIG(*) > @SeenCountThreshold
                {managedHavingFilter}
            ),
            edge_agg AS (
                SELECT
                    node_ciid        = ciid,
                    edge_count       = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT ciid = endpoint_a_ciid, seen_count FROM edge_base WHERE endpoint_a_ciid IS NOT NULL
                    UNION ALL
                    SELECT ciid = endpoint_b_ciid, seen_count FROM edge_base WHERE endpoint_b_ciid IS NOT NULL AND endpoint_b_ciid <> endpoint_a_ciid
                ) x
                GROUP BY ciid
            )
            SELECT
                node_id = CAST(ABS(CHECKSUM(n.ciid)) AS bigint),
                n.ciid,
                n.fqdn,
                n.last_seen,
                edge_count = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0)
            FROM {_nodesTable} n
            LEFT JOIN edge_agg ea
                ON ea.node_ciid = n.ciid
            WHERE
                (n.last_seen > @LastSeen
                OR (
                    n.last_seen = @LastSeen
                    AND CAST(ABS(CHECKSUM(n.ciid)) AS bigint) > @LastId
                ))
                {isolatedFilter}
                {staleFilter}
            ORDER BY n.last_seen, node_id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);

        await using var reader = await command.ExecuteReaderAsync();
        return await ParseNodeSummariesFromReader(reader);
    }

    public async Task<IEnumerable<NodeSummaryEntity>> getCustomerNodeSummariesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var isolatedFilter = queryParams.ExcludeIsolated ? "AND COALESCE(ea.edge_count, 0) > 0" : "";
        var staleFilter = queryParams.MinLastSeenHours.HasValue ? "AND n.last_seen >= DATEADD(HOUR, -@MinLastSeenHours, GETUTCDATE())" : "";
        var managedHavingFilter = queryParams.ManagedOnly ? "AND MAX(e.endpoint_a_ciid) IS NOT NULL AND MAX(e.endpoint_b_ciid) IS NOT NULL" : "";

        var sql = $"""
            WITH edge_base AS (
                -- single pass over connection_edge; spooled for reuse by customer_edge_ciids and edge_agg
                SELECT
                    endpoint_a_ciid = MAX(e.endpoint_a_ciid),
                    endpoint_b_ciid = MAX(e.endpoint_b_ciid),
                    seen_count      = COUNT_BIG(*)
                FROM {_edgesTable} e
                GROUP BY e.edge_key
                HAVING COUNT_BIG(*) > @SeenCountThreshold
                {managedHavingFilter}
            ),
            customer_edge_ciids AS (
                SELECT DISTINCT ea.ciid
                FROM (
                    SELECT ciid = endpoint_a_ciid, other_ciid = endpoint_b_ciid FROM edge_base WHERE endpoint_a_ciid IS NOT NULL
                    UNION ALL
                    SELECT ciid = endpoint_b_ciid, other_ciid = endpoint_a_ciid FROM edge_base WHERE endpoint_b_ciid IS NOT NULL AND endpoint_b_ciid <> endpoint_a_ciid
                ) ea
                INNER JOIN {_nodesTable} na ON na.ciid = ea.ciid
                LEFT JOIN {_nodesTable} nb ON nb.ciid = ea.other_ciid
                WHERE (na.group_id = @CustomerId OR nb.group_id = @CustomerId)
            ),
            edge_agg AS (
                SELECT
                    node_ciid        = ciid,
                    edge_count       = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT ciid = endpoint_a_ciid, seen_count FROM edge_base WHERE endpoint_a_ciid IN (SELECT ciid FROM customer_edge_ciids)
                    UNION ALL
                    SELECT ciid = endpoint_b_ciid, seen_count FROM edge_base WHERE endpoint_b_ciid IN (SELECT ciid FROM customer_edge_ciids) AND endpoint_b_ciid <> endpoint_a_ciid
                ) x
                GROUP BY ciid
            )
            SELECT
                node_id = CAST(ABS(CHECKSUM(n.ciid)) AS bigint),
                n.ciid,
                n.fqdn,
                n.last_seen,
                edge_count = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0)
            FROM {_nodesTable} n
            LEFT JOIN customer_edge_ciids cec ON cec.ciid = n.ciid
            LEFT JOIN edge_agg ea ON ea.node_ciid = n.ciid
            WHERE
                -- include nodes connected to this customer plus isolated nodes owned by this customer
                (cec.ciid IS NOT NULL OR n.group_id = @CustomerId)
                AND (
                    n.last_seen > @LastSeen
                    OR (
                        n.last_seen = @LastSeen
                        AND CAST(ABS(CHECKSUM(n.ciid)) AS bigint) > @LastId
                    )
                )
                {isolatedFilter}
                {staleFilter}
            ORDER BY n.last_seen, node_id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        if (queryParams.MinLastSeenHours.HasValue)
            command.Parameters.AddWithValue("@MinLastSeenHours", queryParams.MinLastSeenHours.Value);

        await using var reader = await command.ExecuteReaderAsync();
        return await ParseNodeSummariesFromReader(reader);
    }

    public async Task<NodeEntity?> getNodeByCiidAsync(string ciid)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            WITH iface_json AS (
                SELECT
                    ni.ciid,
                    interfaces_json = (
                        SELECT
                            adapter = COALESCE(NULLIF(ni2.adapter, ''), NULLIF(ni2.description, ''), 'Unknown'),
                            ip = ip_rows.ip,
                            mac = ni2.mac_address,
                            subnet = ip_rows.subnet,
                            status = COALESCE(NULLIF(ni2.last_status, ''), 'unknown')
                        FROM {_interfacesTable} ni2
                        CROSS APPLY (
                            SELECT
                                ip = ni2.address_ipv4,
                                subnet = COALESCE(ni2.netmask_ipv4, '')
                            WHERE ni2.address_ipv4 IS NOT NULL
                              AND ni2.address_ipv4 <> ''

                            UNION ALL

                            SELECT
                                ip = ni2.address_ipv6,
                                subnet = COALESCE(ni2.netmask_ipv6, '')
                            WHERE ni2.address_ipv6 IS NOT NULL
                              AND ni2.address_ipv6 <> ''
                        ) ip_rows
                        WHERE ni2.ciid = ni.ciid
                        FOR JSON PATH
                    )
                FROM {_interfacesTable} ni
                GROUP BY ni.ciid
            ),
            edge_agg AS (
                SELECT
                    node_ciid,
                    edge_count = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT e.endpoint_a_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold

                    UNION ALL

                    SELECT e.endpoint_b_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold
                      AND e.endpoint_b_ciid <> e.endpoint_a_ciid
                ) x
                WHERE node_ciid IS NOT NULL
                GROUP BY node_ciid
            )
            SELECT
                node_id = CAST(ABS(CHECKSUM(n.ciid)) AS bigint),
                n.ciid,
                n.fqdn,
                n.group_id,
                n.group_name,
                n.first_seen,
                n.last_seen,
                interfaces_json = COALESCE(i.interfaces_json, '[]'),
                edge_count = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0)
            FROM {_nodesTable} n
            LEFT JOIN iface_json i
                ON i.ciid = n.ciid
            LEFT JOIN edge_agg ea
                ON ea.node_ciid = n.ciid
            WHERE n.ciid = @Ciid;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@Ciid", ciid);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        await using var reader = await command.ExecuteReaderAsync();
        return (await ParseNodesFromReader(reader)).FirstOrDefault();
    }

    public async Task<IEnumerable<string>> filterNodeCiidsAsync(
        string? customer, string? ip, string? mac,
        DateTime? firstSeenAfter, DateTime? firstSeenBefore,
        DateTime? lastSeenAfter, DateTime? lastSeenBefore,
        int? scopeCustomerId = null)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var conditions = new List<string> { };

        if (scopeCustomerId.HasValue)
            conditions.Add("n.group_id = @ScopeCustomerId");

        if (!string.IsNullOrWhiteSpace(customer))
            conditions.Add("n.group_name LIKE @Customer");

        if (!string.IsNullOrWhiteSpace(ip))
            conditions.Add($"EXISTS (SELECT 1 FROM {_interfacesTable} ni WHERE ni.ciid = n.ciid AND (ni.address_ipv4 LIKE @Ip OR ni.address_ipv6 LIKE @Ip))");

        if (!string.IsNullOrWhiteSpace(mac))
            conditions.Add($"EXISTS (SELECT 1 FROM {_interfacesTable} ni WHERE ni.ciid = n.ciid AND ni.mac_address LIKE @Mac)");

        if (firstSeenAfter.HasValue)
            conditions.Add("n.first_seen >= @FirstSeenAfter");

        if (firstSeenBefore.HasValue)
            conditions.Add("n.first_seen <= @FirstSeenBefore");

        if (lastSeenAfter.HasValue)
            conditions.Add("n.last_seen >= @LastSeenAfter");

        if (lastSeenBefore.HasValue)
            conditions.Add("n.last_seen <= @LastSeenBefore");

        var whereClause = string.Join(" AND ", conditions);

        var sql = $"""
            SELECT n.ciid
            FROM {_nodesTable} n
            WHERE {whereClause};
            """;

        await using var command = new SqlCommand(sql, connection);

        if (scopeCustomerId.HasValue)
            command.Parameters.AddWithValue("@ScopeCustomerId", scopeCustomerId.Value);

        if (!string.IsNullOrWhiteSpace(customer))
            command.Parameters.AddWithValue("@Customer", $"%{customer}%");

        if (!string.IsNullOrWhiteSpace(ip))
            command.Parameters.AddWithValue("@Ip", $"%{ip}%");

        if (!string.IsNullOrWhiteSpace(mac))
            command.Parameters.AddWithValue("@Mac", $"%{mac}%");

        if (firstSeenAfter.HasValue)
            command.Parameters.Add(new SqlParameter("@FirstSeenAfter", System.Data.SqlDbType.DateTime2) { Value = firstSeenAfter.Value });

        if (firstSeenBefore.HasValue)
            command.Parameters.Add(new SqlParameter("@FirstSeenBefore", System.Data.SqlDbType.DateTime2) { Value = firstSeenBefore.Value });

        if (lastSeenAfter.HasValue)
            command.Parameters.Add(new SqlParameter("@LastSeenAfter", System.Data.SqlDbType.DateTime2) { Value = lastSeenAfter.Value });

        if (lastSeenBefore.HasValue)
            command.Parameters.Add(new SqlParameter("@LastSeenBefore", System.Data.SqlDbType.DateTime2) { Value = lastSeenBefore.Value });

        await using var reader = await command.ExecuteReaderAsync();
        var ciids = new List<string>();
        while (await reader.ReadAsync())
            ciids.Add(reader.GetString(0));

        return ciids;
    }

    private async Task<IEnumerable<NodeSummaryEntity>> ParseNodeSummariesFromReader(SqlDataReader reader)
    {
        var nodes = new List<NodeSummaryEntity>();

        var nodeIdOrdinal = reader.GetOrdinal("node_id");
        var ciidOrdinal = reader.GetOrdinal("ciid");
        var fqdnOrdinal = reader.GetOrdinal("fqdn");
        var edgeCountOrdinal = reader.GetOrdinal("edge_count");
        var connectionCountOrdinal = reader.GetOrdinal("connection_count");
        var lastSeenOrdinal = reader.GetOrdinal("last_seen");

        while (await reader.ReadAsync())
        {
            var nodeId = reader.GetInt64(nodeIdOrdinal);
            var ciid = reader.GetString(ciidOrdinal);
            var fqdn = reader.GetString(fqdnOrdinal);
            var edgeCount = reader.GetInt64(edgeCountOrdinal);
            var connectionCount = reader.GetInt64(connectionCountOrdinal);
            var lastSeen = EnsureUtc(reader.GetDateTime(lastSeenOrdinal));

            nodes.Add(new NodeSummaryEntity(
                NodeId: nodeId,
                Ciid: ciid,
                Fqdn: fqdn,
                Hostname: HostnameFromFqdn(fqdn),
                DistinctEdge: edgeCount,
                ConnectionCount: connectionCount,
                LastSeen: lastSeen
            ));
        }

        return nodes;
    }

    public async Task<IEnumerable<NodeEntity>> getNodesAsync(GraphCursor cursor)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            WITH iface_json AS (
                SELECT
                    ni.ciid,
                    interfaces_json = (
                        SELECT
                            adapter = COALESCE(NULLIF(ni2.adapter, ''), NULLIF(ni2.description, ''), 'Unknown'),
                            ip = ip_rows.ip,
                            mac = ni2.mac_address,
                            subnet = ip_rows.subnet,
                            status = COALESCE(NULLIF(ni2.last_status, ''), 'unknown')
                        FROM {_interfacesTable} ni2
                        CROSS APPLY (
                            SELECT
                                ip = ni2.address_ipv4,
                                subnet = COALESCE(ni2.netmask_ipv4, '')
                            WHERE ni2.address_ipv4 IS NOT NULL
                              AND ni2.address_ipv4 <> ''

                            UNION ALL

                            SELECT
                                ip = ni2.address_ipv6,
                                subnet = COALESCE(ni2.netmask_ipv6, '')
                            WHERE ni2.address_ipv6 IS NOT NULL
                              AND ni2.address_ipv6 <> ''
                        ) ip_rows
                        WHERE ni2.ciid = ni.ciid
                        FOR JSON PATH
                    )
                FROM {_interfacesTable} ni
                GROUP BY ni.ciid
            ),
            edge_agg AS (
                SELECT
                    node_ciid,
                    edge_count = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT e.endpoint_a_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold

                    UNION ALL

                    SELECT e.endpoint_b_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold
                      AND e.endpoint_b_ciid <> e.endpoint_a_ciid
                ) x
                WHERE node_ciid IS NOT NULL
                GROUP BY node_ciid
            )
            SELECT
                node_id = CAST(ABS(CHECKSUM(n.ciid)) AS bigint),
                n.ciid,
                n.fqdn,
                n.group_id,
                n.group_name,
                n.first_seen,
                n.last_seen,
                interfaces_json = COALESCE(i.interfaces_json, '[]'),
                edge_count = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0)
            FROM {_nodesTable} n
            LEFT JOIN iface_json i
                ON i.ciid = n.ciid
            LEFT JOIN edge_agg ea
                ON ea.node_ciid = n.ciid
            WHERE
                (n.last_seen > @LastSeen
                OR (
                    n.last_seen = @LastSeen
                    AND CAST(ABS(CHECKSUM(n.ciid)) AS bigint) > @LastId
                ))
            ORDER BY n.last_seen, node_id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);

        await using var reader = await command.ExecuteReaderAsync();
        return await ParseNodesFromReader(reader);
    }

    public async Task<IEnumerable<NodeEntity>> getCustomerNodesAsync(GraphCursor cursor, int customerId)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            WITH iface_json AS (
                SELECT
                    ni.ciid,
                    interfaces_json = (
                        SELECT
                            adapter = COALESCE(NULLIF(ni2.adapter, ''), NULLIF(ni2.description, ''), 'Unknown'),
                            ip = ip_rows.ip,
                            mac = ni2.mac_address,
                            subnet = ip_rows.subnet,
                            status = COALESCE(NULLIF(ni2.last_status, ''), 'unknown')
                        FROM {_interfacesTable} ni2
                        CROSS APPLY (
                            SELECT
                                ip = ni2.address_ipv4,
                                subnet = COALESCE(ni2.netmask_ipv4, '')
                            WHERE ni2.address_ipv4 IS NOT NULL
                              AND ni2.address_ipv4 <> ''

                            UNION ALL

                            SELECT
                                ip = ni2.address_ipv6,
                                subnet = COALESCE(ni2.netmask_ipv6, '')
                            WHERE ni2.address_ipv6 IS NOT NULL
                              AND ni2.address_ipv6 <> ''
                        ) ip_rows
                        WHERE ni2.ciid = ni.ciid
                        FOR JSON PATH
                    )
                FROM {_interfacesTable} ni
                GROUP BY ni.ciid
            ),
            edge_agg AS (
                SELECT
                    node_ciid,
                    edge_count = COUNT_BIG(*),
                    connection_count = SUM(seen_count)
                FROM (
                    SELECT e.endpoint_a_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold

                    UNION ALL

                    SELECT e.endpoint_b_ciid AS node_ciid, e.id, e.seen_count
                    FROM {_edgeStatsView} e
                    WHERE e.seen_count > @SeenCountThreshold
                      AND e.endpoint_b_ciid <> e.endpoint_a_ciid
                ) x
                WHERE node_ciid IS NOT NULL
                GROUP BY node_ciid
            )
            SELECT
                node_id = CAST(ABS(CHECKSUM(n.ciid)) AS bigint),
                n.ciid,
                n.fqdn,
                n.group_id,
                n.group_name,
                n.first_seen,
                n.last_seen,
                interfaces_json = COALESCE(i.interfaces_json, '[]'),
                edge_count = COALESCE(ea.edge_count, 0),
                connection_count = COALESCE(ea.connection_count, 0)
            FROM {_nodesTable} n
            LEFT JOIN iface_json i
                ON i.ciid = n.ciid
            LEFT JOIN edge_agg ea
                ON ea.node_ciid = n.ciid
            WHERE
                n.group_id = @CustomerId
                AND (
                    n.last_seen > @LastSeen
                    OR (
                        n.last_seen = @LastSeen
                        AND CAST(ABS(CHECKSUM(n.ciid)) AS bigint) > @LastId
                    )
                )
            ORDER BY n.last_seen, node_id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTime2)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);

        await using var reader = await command.ExecuteReaderAsync();
        return await ParseNodesFromReader(reader);
    }

    private async Task<IEnumerable<NodeEntity>> ParseNodesFromReader(SqlDataReader reader)
    {
        var nodes = new List<NodeEntity>();

        var nodeIdOrdinal = reader.GetOrdinal("node_id");
        var serverIdOrdinal = reader.GetOrdinal("ciid");
        var fqdnOrdinal = reader.GetOrdinal("fqdn");
        var groupIdOrdinal = reader.GetOrdinal("group_id");
        var groupNameOrdinal = reader.GetOrdinal("group_name");
        var interfacesJsonOrdinal = reader.GetOrdinal("interfaces_json");
        var edgeCountOrdinal = reader.GetOrdinal("edge_count");
        var connectionCountOrdinal = reader.GetOrdinal("connection_count");
        var firstSeenOrdinal = reader.GetOrdinal("first_seen");
        var lastSeenOrdinal = reader.GetOrdinal("last_seen");

        while (await reader.ReadAsync())
        {
            var id = reader.GetInt64(nodeIdOrdinal);
            var serverId = reader.GetString(serverIdOrdinal);
            var fqdn = reader.GetString(fqdnOrdinal);

            var groupId = reader.IsDBNull(groupIdOrdinal) ? -1 : reader.GetInt32(groupIdOrdinal);
            var groupName = reader.IsDBNull(groupNameOrdinal)
                ? "Unknown"
                : reader.GetString(groupNameOrdinal);

            var interfacesJson = reader.GetString(interfacesJsonOrdinal);
            var interfaces = System.Text.Json.JsonSerializer.Deserialize<List<NetInterface>>(interfacesJson) ?? [];

            var edgeCount = reader.GetInt64(edgeCountOrdinal);
            var connectionCount = reader.GetInt64(connectionCountOrdinal);
            var firstSeen = EnsureUtc(reader.GetDateTime(firstSeenOrdinal));
            var lastSeen = EnsureUtc(reader.GetDateTime(lastSeenOrdinal));

            var customer = new Customer(Name: groupName, CmdbCiId: serverId, Id: groupId);

            nodes.Add(
                new NodeEntity(
                    Id: id,
                    Fqdn: fqdn,
                    Hostname: HostnameFromFqdn(fqdn),
                    Interfaces: interfaces,
                    DistinctEdge: edgeCount,
                    ConnectionCount: connectionCount,
                    Customer: customer,
                    FirstSeen: firstSeen,
                    LastSeen: lastSeen
                )
            );
        }

        return nodes;
    }

    internal async Task<Customer[]> getAllCustomersAsync()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(
            $"""
            SELECT DISTINCT
                group_id,
                group_name
            FROM {_nodesTable}
            WHERE group_id IS NOT NULL
            ORDER BY group_name;
            """,
            connection
        );

        await using var reader = await command.ExecuteReaderAsync();

        var customers = new List<Customer>();
        var groupIdOrdinal = reader.GetOrdinal("group_id");
        var groupNameOrdinal = reader.GetOrdinal("group_name");

        while (await reader.ReadAsync())
        {
            var groupId = reader.GetInt32(groupIdOrdinal);
            var groupName = reader.IsDBNull(groupNameOrdinal)
                ? $"Group {groupId}"
                : reader.GetString(groupNameOrdinal);

            customers.Add(new Customer(Name: groupName, CmdbCiId: string.Empty, Id: groupId));
        }

        return customers.ToArray();
    }

    public async Task<DashboardStats> GetDashboardStatsAsync(int customerId = -1)
    {
        await using var connection = new SqlConnection(ConnectionString);
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
            command.Parameters.AddWithValue("@CustomerId", customerId);

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
        await using var connection = new SqlConnection(ConnectionString);
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
            command.Parameters.AddWithValue("@CustomerId", customerId);

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
        await using var connection = new SqlConnection(ConnectionString);
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
            command.Parameters.AddWithValue("@CustomerId", customerId);

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
        await using var connection = new SqlConnection(ConnectionString);
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
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        if (customerId != -1)
            command.Parameters.AddWithValue("@CustomerId", customerId);

        await using var reader = await command.ExecuteReaderAsync();

        var rows = new List<NodeRow>();
        var ciidOrdinal       = reader.GetOrdinal("ciid");
        var fqdnOrdinal       = reader.GetOrdinal("fqdn");
        var hostnameOrdinal   = reader.GetOrdinal("hostname");
        var edgesOrdinal      = reader.GetOrdinal("distinct_edges");
        var connOrdinal       = reader.GetOrdinal("connection_count");
        var firstSeenOrdinal  = reader.GetOrdinal("first_seen");
        var lastSeenOrdinal   = reader.GetOrdinal("last_seen");
        var groupNameOrdinal  = reader.GetOrdinal("group_name");

        while (await reader.ReadAsync())
        {
            rows.Add(new NodeRow(
                Ciid:           reader.GetString(ciidOrdinal),
                Fqdn:           reader.GetString(fqdnOrdinal),
                Hostname:       reader.GetString(hostnameOrdinal),
                DistinctEdges:  reader.GetInt64(edgesOrdinal),
                ConnectionCount: reader.GetInt64(connOrdinal),
                FirstSeen:      EnsureUtc(reader.GetDateTime(firstSeenOrdinal)),
                LastSeen:       EnsureUtc(reader.GetDateTime(lastSeenOrdinal)),
                GroupName:      reader.GetString(groupNameOrdinal)
            ));
        }

        return rows;
    }
}
