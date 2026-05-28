USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE test.refresh_top_connections
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH normalized_base AS (
            SELECT
                c.Id AS id,
                c.HostName AS host_name,
                UPPER(c.Protocol) AS protocol,
                c.Direction AS direction,
                c.ProcessID AS pid,
                NULLIF(LTRIM(RTRIM(c.ProcessName)), '') AS process_name,

                COALESCE(c.LocalFqdn, c.LocalAddressIPv4) AS source_fqdn,
                c.LocalAddressIPv4 AS source_ip,
                c.LocalPort AS source_port,

                COALESCE(c.RemoteFqdn, c.RemoteAddressIPv4) AS target_fqdn,
                c.RemoteAddressIPv4 AS target_ip,
                c.RemotePort AS target_port,

                c.DateAdded AS date_added,

                CASE
                    -- If both are dynamic, do not use either real port as the grouped service port.
                    -- The real latest ports are still kept in source_port and target_port.
                    WHEN c.LocalPort BETWEEN 49152 AND 65535
                     AND c.RemotePort BETWEEN 49152 AND 65535 THEN 0

                    WHEN sp.port IS NOT NULL AND tp.port IS NULL THEN c.LocalPort
                    WHEN tp.port IS NOT NULL AND sp.port IS NULL THEN c.RemotePort

                    WHEN c.Direction = 'Outgoing' THEN c.RemotePort
                    WHEN c.Direction = 'Incoming' THEN c.LocalPort

                    WHEN c.LocalPort BETWEEN 49152 AND 65535
                     AND c.RemotePort NOT BETWEEN 49152 AND 65535 THEN c.RemotePort

                    WHEN c.RemotePort BETWEEN 49152 AND 65535
                     AND c.LocalPort NOT BETWEEN 49152 AND 65535 THEN c.LocalPort

                    ELSE IIF(c.LocalPort <= c.RemotePort, c.LocalPort, c.RemotePort)
                END AS service_port
            FROM test.connections AS c
            LEFT JOIN test.known_ports AS sp
                ON UPPER(c.Protocol) = sp.protocol
               AND c.LocalPort = sp.port
            LEFT JOIN test.known_ports AS tp
                ON UPPER(c.Protocol) = tp.protocol
               AND c.RemotePort = tp.port
        ),
        normalized AS (
            SELECT
                nb.*,

                nb.source_fqdn AS endpoint_a,
                nb.target_fqdn AS endpoint_b,

                CASE
                    WHEN nb.service_port = 0 THEN nb.target_fqdn
                    WHEN nb.service_port = nb.source_port THEN nb.source_fqdn
                    WHEN nb.service_port = nb.target_port THEN nb.target_fqdn
                    ELSE nb.target_fqdn
                END AS service_fqdn,

                CASE
                    WHEN nb.service_port = 0 THEN 'Dynamic'
                    ELSE COALESCE(kp.service_name, 'Unknown')
                END AS service_name,

                CASE
                    WHEN LOWER(nb.host_name) = LOWER(nb.source_fqdn)
                      OR LOWER(nb.host_name) = LOWER(LEFT(nb.source_fqdn, CHARINDEX('.', nb.source_fqdn + '.') - 1))
                    THEN nb.pid
                END AS normalized_source_pid,

                CASE
                    WHEN LOWER(nb.host_name) = LOWER(nb.source_fqdn)
                      OR LOWER(nb.host_name) = LOWER(LEFT(nb.source_fqdn, CHARINDEX('.', nb.source_fqdn + '.') - 1))
                    THEN nb.process_name
                END AS normalized_source_process_name,

                CASE
                    WHEN LOWER(nb.host_name) = LOWER(nb.target_fqdn)
                      OR LOWER(nb.host_name) = LOWER(LEFT(nb.target_fqdn, CHARINDEX('.', nb.target_fqdn + '.') - 1))
                    THEN nb.pid
                END AS normalized_target_pid,

                CASE
                    WHEN LOWER(nb.host_name) = LOWER(nb.target_fqdn)
                      OR LOWER(nb.host_name) = LOWER(LEFT(nb.target_fqdn, CHARINDEX('.', nb.target_fqdn + '.') - 1))
                    THEN nb.process_name
                END AS normalized_target_process_name
            FROM normalized_base AS nb
            LEFT JOIN test.known_ports AS kp
                ON nb.protocol = kp.protocol
               AND nb.service_port = kp.port
        ),
        enriched AS (
            SELECT
                *,
                COALESCE(
                    normalized_source_process_name,
                    normalized_target_process_name,
                    'unknown'
                ) AS known_process_name
            FROM normalized
        ),
        grouped AS (
            SELECT
                endpoint_a,
                endpoint_b,
                protocol,
                service_fqdn,
                service_port,
                known_process_name,

                MAX(service_name) AS service_name,
                COUNT_BIG(*) AS seen_count,

                MIN(date_added) AS first_seen,
                MAX(date_added) AS last_seen
            FROM enriched
            GROUP BY
                endpoint_a,
                endpoint_b,
                protocol,
                service_fqdn,
                service_port,
                known_process_name
        ),
        latest_row AS (
            SELECT
                *,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        endpoint_a,
                        endpoint_b,
                        protocol,
                        service_fqdn,
                        service_port,
                        known_process_name
                    ORDER BY date_added DESC, id DESC
                ) AS rn
            FROM enriched
        ),
        source_rows AS (
            SELECT
                lr.endpoint_a,
                lr.endpoint_b,
                lr.protocol,
                lr.service_fqdn,
                lr.service_port,
                g.service_name,
                lr.known_process_name,
                g.seen_count,

                lr.source_fqdn,
                lr.source_ip,
                lr.source_port,
                lr.normalized_source_pid AS source_pid,
                lr.normalized_source_process_name AS source_process_name,

                lr.target_fqdn,
                lr.target_ip,
                lr.target_port,
                lr.normalized_target_pid AS target_pid,
                lr.normalized_target_process_name AS target_process_name,

                g.first_seen,
                g.last_seen
            FROM latest_row AS lr
            INNER JOIN grouped AS g
                ON lr.endpoint_a = g.endpoint_a
               AND lr.endpoint_b = g.endpoint_b
               AND lr.protocol = g.protocol
               AND ISNULL(lr.service_fqdn, '') = ISNULL(g.service_fqdn, '')
               AND ISNULL(lr.service_port, -1) = ISNULL(g.service_port, -1)
               AND ISNULL(lr.known_process_name, 'unknown') = ISNULL(g.known_process_name, 'unknown')
            WHERE lr.rn = 1
        )
        MERGE test.top_connections AS target
        USING source_rows AS source
            ON target.endpoint_a = source.endpoint_a
           AND target.endpoint_b = source.endpoint_b
           AND target.protocol = source.protocol
           AND ISNULL(target.service_fqdn, '') = ISNULL(source.service_fqdn, '')
           AND ISNULL(target.service_port, -1) = ISNULL(source.service_port, -1)
           AND ISNULL(target.known_process_name, 'unknown') = ISNULL(source.known_process_name, 'unknown')

        WHEN MATCHED THEN
            UPDATE SET
                service_name = source.service_name,
                known_process_name = source.known_process_name,
                seen_count = source.seen_count,

                source_fqdn = source.source_fqdn,
                source_ip = source.source_ip,
                source_port = source.source_port,
                source_pid = source.source_pid,
                source_process_name = source.source_process_name,

                target_fqdn = source.target_fqdn,
                target_ip = source.target_ip,
                target_port = source.target_port,
                target_pid = source.target_pid,
                target_process_name = source.target_process_name,

                first_seen = source.first_seen,
                last_seen = source.last_seen

        WHEN NOT MATCHED THEN
            INSERT (
                endpoint_a,
                endpoint_b,
                protocol,
                service_fqdn,
                service_port,
                service_name,
                known_process_name,
                seen_count,

                source_fqdn,
                source_ip,
                source_port,
                source_pid,
                source_process_name,

                target_fqdn,
                target_ip,
                target_port,
                target_pid,
                target_process_name,

                first_seen,
                last_seen
            )
            VALUES (
                source.endpoint_a,
                source.endpoint_b,
                source.protocol,
                source.service_fqdn,
                source.service_port,
                source.service_name,
                source.known_process_name,
                source.seen_count,

                source.source_fqdn,
                source.source_ip,
                source.source_port,
                source.source_pid,
                source.source_process_name,

                source.target_fqdn,
                source.target_ip,
                source.target_port,
                source.target_pid,
                source.target_process_name,

                source.first_seen,
                source.last_seen
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
