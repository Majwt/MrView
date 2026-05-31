USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_top_connections
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH base AS (
            SELECT
                c.Id,
                host_name = LOWER(c.HostName),
                c.Direction,
                c.ProcessID,
                process_name = NULLIF(LTRIM(RTRIM(c.ProcessName)), ''),

                left_fqdn = LOWER(COALESCE(c.LocalFqdn, c.LocalAddressIPv4)),
                left_ip = c.LocalAddressIPv4,
                left_port = c.LocalPort,

                right_fqdn = LOWER(COALESCE(c.RemoteFqdn, c.RemoteAddressIPv4)),
                right_ip = c.RemoteAddressIPv4,
                right_port = c.RemotePort,

                c.DateAdded,

                left_ephemeral_start = COALESCE(left_node.EphemeralPortStart, 49152),
                left_ephemeral_end = COALESCE(left_node.EphemeralPortEnd, 65535),

                right_ephemeral_start = COALESCE(right_node.EphemeralPortStart, 49152),
                right_ephemeral_end = COALESCE(right_node.EphemeralPortEnd, 65535),

                left_known_port = left_port.port,
                right_known_port = right_port.port
            FROM dbo.connections c

            OUTER APPLY (
                SELECT TOP (1)
                    n.EphemeralPortStart,
                    n.EphemeralPortEnd
                FROM dbo.nodes n
                WHERE LOWER(n.Fqdn) = LOWER(COALESCE(c.LocalFqdn, ''))
                   OR n.AddressIPv4 = c.LocalAddressIPv4
                ORDER BY
                    CASE WHEN n.AddressIPv4 = c.LocalAddressIPv4 THEN 0 ELSE 1 END,
                    n.DateAdded DESC
            ) left_node

            OUTER APPLY (
                SELECT TOP (1)
                    n.EphemeralPortStart,
                    n.EphemeralPortEnd
                FROM dbo.nodes n
                WHERE LOWER(n.Fqdn) = LOWER(COALESCE(c.RemoteFqdn, ''))
                   OR n.AddressIPv4 = c.RemoteAddressIPv4
                ORDER BY
                    CASE WHEN n.AddressIPv4 = c.RemoteAddressIPv4 THEN 0 ELSE 1 END,
                    n.DateAdded DESC
            ) right_node

            LEFT JOIN dbo.known_ports left_port
                ON c.LocalPort = left_port.port

            LEFT JOIN dbo.known_ports right_port
                ON c.RemotePort = right_port.port
        ),
        classified AS (
            SELECT
                b.*,

                left_is_ephemeral =
                    CASE
                        WHEN b.left_port BETWEEN b.left_ephemeral_start AND b.left_ephemeral_end
                        THEN 1 ELSE 0
                    END,

                right_is_ephemeral =
                    CASE
                        WHEN b.right_port BETWEEN b.right_ephemeral_start AND b.right_ephemeral_end
                        THEN 1 ELSE 0
                    END,

                service_port =
                    CASE
                        WHEN b.left_port BETWEEN b.left_ephemeral_start AND b.left_ephemeral_end
                         AND b.right_port BETWEEN b.right_ephemeral_start AND b.right_ephemeral_end
                        THEN 0

                        WHEN b.left_known_port IS NOT NULL
                         AND b.right_known_port IS NULL
                        THEN b.left_port

                        WHEN b.right_known_port IS NOT NULL
                         AND b.left_known_port IS NULL
                        THEN b.right_port

                        WHEN b.left_port BETWEEN b.left_ephemeral_start AND b.left_ephemeral_end
                         AND b.right_port NOT BETWEEN b.right_ephemeral_start AND b.right_ephemeral_end
                        THEN b.right_port

                        WHEN b.right_port BETWEEN b.right_ephemeral_start AND b.right_ephemeral_end
                         AND b.left_port NOT BETWEEN b.left_ephemeral_start AND b.left_ephemeral_end
                        THEN b.left_port

                        WHEN b.Direction = 'Outgoing'
                        THEN b.right_port

                        WHEN b.Direction = 'Incoming'
                        THEN b.left_port

                        ELSE IIF(b.left_port <= b.right_port, b.left_port, b.right_port)
                    END
            FROM base b
        ),
        canonical AS (
            SELECT
                c.*,

                service_is_left =
                    CASE
                        WHEN c.service_port = c.left_port
                         AND c.service_port <> c.right_port
                        THEN 1
                        ELSE 0
                    END,

                service_is_right =
                    CASE
                        WHEN c.service_port = c.right_port
                        THEN 1
                        ELSE 0
                    END
            FROM classified c
        ),
        normalized AS (
            SELECT
                Id,
                host_name,
                Direction,
                ProcessID,
                process_name,
                DateAdded,

                service_port,

                source_fqdn =
                    CASE
                        WHEN service_is_left = 1 THEN right_fqdn
                        ELSE left_fqdn
                    END,

                source_ip =
                    CASE
                        WHEN service_is_left = 1 THEN right_ip
                        ELSE left_ip
                    END,

                source_port =
                    CASE
                        WHEN service_is_left = 1 THEN right_port
                        ELSE left_port
                    END,

                target_fqdn =
                    CASE
                        WHEN service_is_left = 1 THEN left_fqdn
                        ELSE right_fqdn
                    END,

                target_ip =
                    CASE
                        WHEN service_is_left = 1 THEN left_ip
                        ELSE right_ip
                    END,

                target_port =
                    CASE
                        WHEN service_is_left = 1 THEN left_port
                        ELSE right_port
                    END
            FROM canonical
        ),
        enriched AS (
            SELECT
                n.*,

                endpoint_a = n.source_fqdn,
                endpoint_b = n.target_fqdn,

                service_fqdn =
                    CASE
                        WHEN n.service_port = 0 THEN n.target_fqdn
                        ELSE n.target_fqdn
                    END,

                service_name =
                    CASE
                        WHEN n.service_port = 0 THEN 'Dynamic'
                        ELSE COALESCE(kp.service_name, 'Unknown')
                    END,

                source_pid =
                    CASE
                        WHEN n.host_name = n.source_fqdn
                          OR n.host_name = LEFT(n.source_fqdn, CHARINDEX('.', n.source_fqdn + '.') - 1)
                        THEN n.ProcessID
                    END,

                source_process_name =
                    CASE
                        WHEN n.host_name = n.source_fqdn
                          OR n.host_name = LEFT(n.source_fqdn, CHARINDEX('.', n.source_fqdn + '.') - 1)
                        THEN n.process_name
                    END,

                target_pid =
                    CASE
                        WHEN n.host_name = n.target_fqdn
                          OR n.host_name = LEFT(n.target_fqdn, CHARINDEX('.', n.target_fqdn + '.') - 1)
                        THEN n.ProcessID
                    END,

                target_process_name =
                    CASE
                        WHEN n.host_name = n.target_fqdn
                          OR n.host_name = LEFT(n.target_fqdn, CHARINDEX('.', n.target_fqdn + '.') - 1)
                        THEN n.process_name
                    END,

                edge_group_key =
                    CONCAT(
                        LOWER(n.source_fqdn), '|',
                        LOWER(n.target_fqdn), '|',
                        LOWER(ISNULL(n.target_fqdn, '')), '|',
                        ISNULL(CONVERT(varchar(20), n.service_port), '')
                    )
            FROM normalized n
            LEFT JOIN dbo.known_ports kp
                ON n.service_port = kp.port
        ),
        grouped AS (
            SELECT
                edge_group_key,

                endpoint_a = MAX(endpoint_a),
                endpoint_b = MAX(endpoint_b),
                service_fqdn = MAX(service_fqdn),
                service_port = MAX(service_port),
                service_name = MAX(service_name),

                seen_count = COUNT_BIG(*),
                first_seen = MIN(DateAdded),
                last_seen = MAX(DateAdded)
            FROM enriched
            GROUP BY edge_group_key
        ),
        latest_row AS (
            SELECT
                e.*,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY e.edge_group_key
                    ORDER BY e.DateAdded DESC, e.Id DESC
                )
            FROM enriched e
        ),
        ranked_processes AS (
            SELECT
                e.*,

                rn_source_process = ROW_NUMBER() OVER (
                    PARTITION BY e.edge_group_key
                    ORDER BY
                        CASE WHEN e.source_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        e.DateAdded DESC,
                        e.Id DESC
                ),

                rn_target_process = ROW_NUMBER() OVER (
                    PARTITION BY e.edge_group_key
                    ORDER BY
                        CASE WHEN e.target_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        e.DateAdded DESC,
                        e.Id DESC
                )
            FROM enriched e
        ),
        process_agg AS (
            SELECT
                edge_group_key,

                source_pid =
                    MAX(CASE WHEN rn_source_process = 1 THEN source_pid END),

                source_process_name =
                    MAX(CASE WHEN rn_source_process = 1 THEN source_process_name END),

                target_pid =
                    MAX(CASE WHEN rn_target_process = 1 THEN target_pid END),

                target_process_name =
                    MAX(CASE WHEN rn_target_process = 1 THEN target_process_name END)
            FROM ranked_processes
            GROUP BY edge_group_key
        ),
        source_rows AS (
            SELECT
                g.endpoint_a,
                g.endpoint_b,
                g.service_fqdn,
                g.service_port,
                g.service_name,
                g.seen_count,

                lr.source_fqdn,
                lr.source_ip,
                lr.source_port,
                pa.source_pid,
                pa.source_process_name,

                lr.target_fqdn,
                lr.target_ip,
                lr.target_port,
                pa.target_pid,
                pa.target_process_name,

                g.first_seen,
                g.last_seen
            FROM grouped g
            INNER JOIN latest_row lr
                ON lr.edge_group_key = g.edge_group_key
               AND lr.rn = 1
            LEFT JOIN process_agg pa
                ON pa.edge_group_key = g.edge_group_key
        )
        MERGE dbo.top_connections AS target
        USING source_rows AS source
            ON target.endpoint_a = source.endpoint_a
           AND target.endpoint_b = source.endpoint_b
           AND ISNULL(target.service_fqdn, '') = ISNULL(source.service_fqdn, '')
           AND ISNULL(target.service_port, -1) = ISNULL(source.service_port, -1)

        WHEN MATCHED THEN
            UPDATE SET
                service_name = source.service_name,
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
                service_fqdn,
                service_port,
                service_name,
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
                source.service_fqdn,
                source.service_port,
                source.service_name,
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