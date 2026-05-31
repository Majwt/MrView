USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_top_nodes
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH node_base AS (
            SELECT
                Fqdn = LOWER(Fqdn),

                CmdbCiId = MAX(CmdbCiId),
                Customer = MAX(Customer),
                CustomerID = MAX(CustomerID),

                EphemeralPortStart = MIN(EphemeralPortStart),
                EphemeralPortEnd = MAX(EphemeralPortEnd),

                FirstSeen = MIN(DateAdded),
                LastSeen = MAX(DateAdded)
            FROM dbo.nodes
            GROUP BY LOWER(Fqdn)
        ),
        edge_rows AS (
            SELECT
                node_fqdn = endpoint_a,
                edge_id = Id,
                seen_count
            FROM dbo.top_connections

            UNION ALL

            SELECT
                node_fqdn = endpoint_b,
                edge_id = Id,
                seen_count
            FROM dbo.top_connections
            WHERE endpoint_b <> endpoint_a
        ),
        edge_agg AS (
            SELECT
                node_fqdn,
                EdgeCount = COUNT(DISTINCT edge_id),
                ConnectionCount = SUM(seen_count)
            FROM edge_rows
            GROUP BY node_fqdn
        )
        MERGE dbo.top_nodes AS target
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
                        x.AdapterName AS adapter,
                        x.AddressIPv4 AS ip,
                        x.MacAddress AS mac,
                        x.Subnet AS subnet
                    FROM (
                        SELECT DISTINCT
                            AdapterName,
                            AddressIPv4,
                            MacAddress,
                            Subnet
                        FROM dbo.nodes ni
                        WHERE LOWER(ni.Fqdn) = n.Fqdn
                    ) x
                    ORDER BY x.AddressIPv4, x.AdapterName
                    FOR JSON PATH
                ),

                n.EphemeralPortStart,
                n.EphemeralPortEnd,

                n.CmdbCiId,
                n.Customer,
                n.CustomerID,

                EdgeCount = ISNULL(e.EdgeCount, 0),
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
                EphemeralPortStart = source.EphemeralPortStart,
                EphemeralPortEnd = source.EphemeralPortEnd,
                CmdbCiId = source.CmdbCiId,
                Customer = source.Customer,
                CustomerID = source.CustomerID,
                EdgeCount = source.EdgeCount,
                ConnectionCount = source.ConnectionCount,
                FirstSeen = source.FirstSeen,
                LastSeen = source.LastSeen

        WHEN NOT MATCHED THEN
            INSERT (
                Fqdn,
                Hostname,
                InterfacesJson,
                EphemeralPortStart,
                EphemeralPortEnd,
                CmdbCiId,
                Customer,
                CustomerID,
                EdgeCount,
                ConnectionCount,
                FirstSeen,
                LastSeen
            )
            VALUES (
                source.Fqdn,
                source.Hostname,
                source.InterfacesJson,
                source.EphemeralPortStart,
                source.EphemeralPortEnd,
                source.CmdbCiId,
                source.Customer,
                source.CustomerID,
                source.EdgeCount,
                source.ConnectionCount,
                source.FirstSeen,
                source.LastSeen
            );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO