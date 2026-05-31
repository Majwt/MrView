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
            configuration.GetConnectionString(Config.CONNECTION_STRING_NAME)
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
        endpoint_a,
        endpoint_b,

        service_fqdn,
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
        last_seen,

        edge_key
          ";

    public async Task<IEnumerable<EdgeEntity>> getEdgesAsync(GraphCursor cursor)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            SELECT
              {_edgesColumns}
            FROM {_edgesTable}
            WHERE seen_count > @SeenCountThreshold
                AND (
                    last_seen > @LastSeen
                    OR (
                        last_seen = @LastSeen
                        AND id > @LastId
                        )
                    )
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTimeOffset)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        await using var reader = await command.ExecuteReaderAsync();
        try
        {
            var edges = await ParseEdgesFromReader(reader);
            return edges;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing edges from database.");
            return [];
        }
    }

    public async Task<IEnumerable<EdgeEntity>>  getCustomerEdges(GraphCursor cursor, int customerId)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
            SELECT
              {_edgesColumns}
            FROM {_edgesTable}
            WHERE seen_count > @SeenCountThreshold
                AND CustomerID = @CustomerId
                AND (
                    last_seen > @LastSeen
                    OR (
                        last_seen = @LastSeen
                        AND id > @LastId
                        )
                    )
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTimeOffset)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenEdgeId);
        command.Parameters.AddWithValue("@SeenCountThreshold", SeenCountThreshold);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        await using var reader = await command.ExecuteReaderAsync();
        try
        {
            var edges = await ParseEdgesFromReader(reader);
            return edges;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing edges from database.");
            return [];
        }
    }

    private async Task<IEnumerable<EdgeEntity>> ParseEdgesFromReader(SqlDataReader reader)
    {
        var edges = new List<EdgeEntity>();
        var idOrdinal = reader.GetOrdinal("id");

        var endpointAOrdinal = reader.GetOrdinal("endpoint_a");
        var endpointBOrdinal = reader.GetOrdinal("endpoint_b");


        var serviceFqdnOrdinal = reader.GetOrdinal("service_fqdn");
        var servicePortOrdinal = reader.GetOrdinal("service_port");
        var serviceNameOrdinal = reader.GetOrdinal("service_name");


        var seenCountOrdinal = reader.GetOrdinal("seen_count");

        var sourceIpOrdinal = reader.GetOrdinal("source_ip");
        var sourcePortOrdinal = reader.GetOrdinal("source_port");
        var sourceFqdnOrdinal = reader.GetOrdinal("source_fqdn");
        var sourcePidOrdinal = reader.GetOrdinal("source_pid");
        var sourceProcessNameOrdinal = reader.GetOrdinal("source_process_name");

        var targetIpOrdinal = reader.GetOrdinal("target_ip");
        var targetPortOrdinal = reader.GetOrdinal("target_port");
        var targetFqdnOrdinal = reader.GetOrdinal("target_fqdn");
        var targetPidOrdinal = reader.GetOrdinal("target_pid");
        var targetProcessNameOrdinal = reader.GetOrdinal("target_process_name");

        var lastSeenOrdinal = reader.GetOrdinal("last_seen");
        var firstSeenOrdinal = reader.GetOrdinal("first_seen");

        var edgeKeyOrdinal = reader.GetOrdinal("edge_key");
        var count = 0;

        while (await reader.ReadAsync())
        {
            count++;

            var id = reader.GetInt64(idOrdinal);

            var endpointA = reader.GetString(endpointAOrdinal);
            var endpointB = reader.GetString(endpointBOrdinal);



            var serviceFqdn = reader.GetString(serviceFqdnOrdinal);
            var serviceName = reader.GetString(serviceNameOrdinal);
            var servicePort = reader.IsDBNull(servicePortOrdinal)
                ? null
                : (int?)reader.GetInt32(servicePortOrdinal);


            var sourceIp = reader.GetString(sourceIpOrdinal);
            var sourcePort = reader.IsDBNull(sourcePortOrdinal)
                ? null
                : (int?)reader.GetInt32(sourcePortOrdinal);

            var sourceFqdn = reader.GetString(sourceFqdnOrdinal);

            var sourcePid = reader.IsDBNull(sourcePidOrdinal)
                ? null
                : (int?)reader.GetInt32(sourcePidOrdinal);

            var sourceProcessName = reader.IsDBNull(sourceProcessNameOrdinal)
                ? null
                : reader.GetString(sourceProcessNameOrdinal);

            var targetIp = reader.GetString(targetIpOrdinal);

            var targetPort = reader.IsDBNull(targetPortOrdinal)
                ? null
                : (int?)reader.GetInt32(targetPortOrdinal);

            var targetFqdn = reader.GetString(targetFqdnOrdinal);

            var targetPid = reader.IsDBNull(targetPidOrdinal)
                ? null
                : (int?)reader.GetInt32(targetPidOrdinal);

            var targetProcessName = reader.IsDBNull(targetProcessNameOrdinal)
                ? null
                : reader.GetString(targetProcessNameOrdinal);

            var seenCount = reader.GetInt64(seenCountOrdinal);
            var lastSeen = reader.GetDateTimeOffset(lastSeenOrdinal);
            var firstSeen = reader.GetDateTimeOffset(firstSeenOrdinal);

            var edgeKey = reader.GetString(edgeKeyOrdinal);

            var edge = new EdgeEntity(
                Id: id,
                EndpointA: endpointA,
                EndpointB: endpointB,
                ServiceFqdn: serviceFqdn,
                ServicePort: servicePort,
                ServiceName: serviceName,
                SeenCount: seenCount,
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
                LastSeen: lastSeen,
                FirstSeen: firstSeen,
                EdgeKey: edgeKey
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
        EdgeCount,
        ConnectionCount,
        FirstSeen,
        LastSeen
          ";

    public async Task<IEnumerable<NodeEntity>> getNodesAsync(GraphCursor cursor)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
                SELECT
                {_nodesColumns}
                FROM {_nodesTable}
                WHERE
                    LastSeen > @LastSeen
                    OR (
                        LastSeen = @LastSeen
                        AND Id > @LastId
                    )
                ORDER BY LastSeen, Id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTimeOffset)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        await using var reader = await command.ExecuteReaderAsync();

        return await ParseNodesFromReader(reader);
    }

    public async Task<IEnumerable<NodeEntity>> getCustomerNodesAsync(
        GraphCursor cursor,
        int customerId
    )
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        var sql = $"""
                SELECT
                {_nodesColumns}
                FROM {_nodesTable}
                WHERE
                    CustomerID = @CustomerId
                    AND (
                    LastSeen > @LastSeen
                    OR (
                        LastSeen = @LastSeen
                        AND Id > @LastId
                    )
                    )
                ORDER BY LastSeen, Id;
            """;


        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@CustomerId", customerId);
        command.Parameters.Add(new SqlParameter("@LastSeen", System.Data.SqlDbType.DateTimeOffset)
        {
            Value = cursor.LastSeen
        });
        command.Parameters.AddWithValue("@LastId", cursor.LastSeenNodeId);
        await using var reader = await command.ExecuteReaderAsync();

        try
        {
            return await ParseNodesFromReader(reader);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing nodes from database.");
            return [];
        }
    }

    private async Task<IEnumerable<NodeEntity>> ParseNodesFromReader(SqlDataReader reader)
    {
        var nodes = new List<NodeEntity>();
        var idOrdinal = reader.GetOrdinal("Id");
        var fqdnOrdinal = reader.GetOrdinal("Fqdn");
        var hostnameOrdinal = reader.GetOrdinal("Hostname");

        var interfacesJsonOrdinal = reader.GetOrdinal("InterfacesJson");

        var distinctEdgesOrdinal = reader.GetOrdinal("EdgeCount");
        var connectionCountOrdinal = reader.GetOrdinal("ConnectionCount");

        var customerOrdinal = reader.GetOrdinal("Customer");
        var cmdbCiIdOrdinal = reader.GetOrdinal("CmdbCiId");
        var customerIdOrdinal = reader.GetOrdinal("CustomerID");

        var firstSeenOrdinal = reader.GetOrdinal("FirstSeen");
        var lastSeenOrdinal = reader.GetOrdinal("LastSeen");

        while (await reader.ReadAsync())
        {
            var id = reader.GetInt64(idOrdinal);

            var fqdn = reader.GetString(fqdnOrdinal);
            var hostname = reader.GetString(hostnameOrdinal);

            var interfacesJson = reader.GetString(interfacesJsonOrdinal);

            var interfaces = System.Text.Json.JsonSerializer.Deserialize<List<NetInterface>>(
                interfacesJson
            );

            if (interfaces == null || interfaces.Count == 0)
            {
                continue;
            }

            var distinctEdges = reader.GetInt64(distinctEdgesOrdinal);
            var connectionCount = reader.GetInt64(connectionCountOrdinal);

            var customerName = reader.GetString(customerOrdinal);
            var cmdbCiId = reader.GetString(cmdbCiIdOrdinal);
            var customerId = reader.GetInt32(customerIdOrdinal);

            var firstSeen = reader.GetDateTimeOffset(firstSeenOrdinal);
            var lastSeen = reader.GetDateTimeOffset(lastSeenOrdinal);

            var customer = new Customer(Name: customerName, CmdbCiId: cmdbCiId, Id: customerId);

            var node = new NodeEntity(
                Id: id,
                Fqdn: fqdn,
                Hostname: hostname,
                Interfaces: interfaces,
                DistinctEdge: distinctEdges,
                ConnectionCount: connectionCount,
                Customer: customer,
                FirstSeen: firstSeen,
                LastSeen: lastSeen
            );

            nodes.Add(node);
        }
        return nodes;
    }
}
