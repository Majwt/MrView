
CREATE OR ALTER PROCEDURE [test].refresh_top_nodes
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH node_base AS (
        SELECT
            Fqdn,
            CmdbCiId = MAX(CmdbCiId),
            Customer = MAX(Customer),
            CustomerID = MAX(CustomerID),
            FirstSeen = MIN(DateAdded),
            LastSeen = MAX(DateAdded)
        FROM axinetstat.[test].nodes
        GROUP BY Fqdn
    ),
    edge_rows AS (
        SELECT
            node_fqdn = source_fqdn,
            edge_id = id,
            seen_count
        FROM axinetstat.[test].top_connections

        UNION ALL

        SELECT
            node_fqdn = target_fqdn,
            edge_id = id,
            seen_count
        FROM axinetstat.[test].top_connections
        WHERE target_fqdn <> source_fqdn
    ),
    edge_agg AS (
        SELECT
            node_fqdn,
            UniqueEdges = COUNT(DISTINCT edge_id),
            ConnectionCount = SUM(seen_count)
        FROM edge_rows
        GROUP BY node_fqdn
    )
    MERGE axinetstat.[test].top_nodes AS target
    USING (
        SELECT
            n.Fqdn,
            Hostname =
                CASE
                    WHEN CHARINDEX('.', n.Fqdn) > 0
                    THEN LEFT(n.Fqdn, CHARINDEX('.', n.Fqdn) - 1)
                    ELSE n.Fqdn
                END,

            InterfacesJson = (
                SELECT
                    x.AddressIPv4 AS ip,
                    x.MacAddress AS mac,
                    x.Subnet AS subnet
                FROM (
                    SELECT DISTINCT
                        AddressIPv4,
                        MacAddress,
                        Subnet
                    FROM axinetstat.[test].nodes ni
                    WHERE ni.Fqdn = n.Fqdn
                ) x
                ORDER BY x.AddressIPv4, x.MacAddress
                FOR JSON PATH
            ),

            n.CmdbCiId,
            n.Customer,
            n.CustomerID,
            UniqueEdges = ISNULL(e.UniqueEdges, 0),
            ConnectionCount = ISNULL(e.ConnectionCount, 0),
            n.FirstSeen,
            n.LastSeen
        FROM node_base n
        LEFT JOIN edge_agg e
            ON e.node_fqdn = n.Fqdn
    ) AS source
    ON target.Fqdn = source.Fqdn

    WHEN MATCHED THEN
        UPDATE SET
            Hostname = source.Hostname,
            InterfacesJson = source.InterfacesJson,
            CmdbCiId = source.CmdbCiId,
            Customer = source.Customer,
            CustomerID = source.CustomerID,
            UniqueEdges = source.UniqueEdges,
            ConnectionCount = source.ConnectionCount,
            FirstSeen = source.FirstSeen,
            LastSeen = source.LastSeen

    WHEN NOT MATCHED THEN
        INSERT (
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
        )
        VALUES (
            source.Fqdn,
            source.Hostname,
            source.InterfacesJson,
            source.CmdbCiId,
            source.Customer,
            source.CustomerID,
            source.UniqueEdges,
            source.ConnectionCount,
            source.FirstSeen,
            source.LastSeen
        );
END;
