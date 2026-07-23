USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_connection_edge
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH latest_node_raw AS (
            SELECT
                nr.server_id,
                nr.ephemeral_port_start,
                nr.ephemeral_port_end,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY nr.server_id
                    ORDER BY nr.observed_at DESC, nr.id DESC
                )
            FROM dbo.node_raw nr
        ),
        node_ranges AS (
            SELECT
                server_id,
                ephemeral_port_start = COALESCE(ephemeral_port_start, 49152),
                ephemeral_port_end = COALESCE(ephemeral_port_end, 65535)
            FROM latest_node_raw
            WHERE rn = 1
        ),
        managed_lookup AS (
            SELECT
                server_id,
                fqdn = LOWER(fqdn)
            FROM dbo.managed_node
            WHERE fqdn IS NOT NULL
        ),
        raw_base AS (
            SELECT
                r.id,
                r.observed_at,
                direction = UPPER(LTRIM(RTRIM(ISNULL(r.direction, 'OUTGOING')))),
                protocol = LOWER(LTRIM(RTRIM(ISNULL(r.protocol, 'tcp')))),

                local_fqdn = LOWER(COALESCE(local_match.fqdn, r.local_fqdn)),
                r.local_address_ipv4,
                local_mac_address = LOWER(r.local_mac_address),
                local_server_id = r.reporter_server_id,
                local_port = r.local_port,

                remote_fqdn = LOWER(COALESCE(remote_match.fqdn, r.remote_fqdn)),
                r.remote_address_ipv4,
                remote_mac_address = LOWER(r.remote_mac_address),
                remote_server_id = remote_match.server_id,
                remote_port = r.remote_port,

                r.process_name,
                r.process_id,

                local_ephemeral_port_start = COALESCE(local_range.ephemeral_port_start, 49152),
                local_ephemeral_port_end = COALESCE(local_range.ephemeral_port_end, 65535),
                remote_ephemeral_port_start = COALESCE(remote_range.ephemeral_port_start, 49152),
                remote_ephemeral_port_end = COALESCE(remote_range.ephemeral_port_end, 65535)
            FROM dbo.connection_raw r
            LEFT JOIN node_ranges local_range
                ON local_range.server_id = r.reporter_server_id
            OUTER APPLY (
                SELECT TOP (1)
                    ni.fqdn
                FROM dbo.node_interface ni
                WHERE ni.server_id = r.reporter_server_id
                  AND LOWER(ni.mac_address) = LOWER(r.local_mac_address)
                ORDER BY
                    CASE WHEN ni.address_ipv4 = r.local_address_ipv4 THEN 0 ELSE 1 END,
                    ni.last_seen DESC
            ) local_match
            OUTER APPLY (
                SELECT TOP (1)
                    ni.server_id,
                    ni.fqdn
                FROM dbo.node_interface ni
                WHERE LOWER(ni.mac_address) = LOWER(r.remote_mac_address)
                ORDER BY
                    CASE WHEN ni.address_ipv4 = r.remote_address_ipv4 THEN 0 ELSE 1 END,
                    ni.last_seen DESC
            ) remote_match
            LEFT JOIN node_ranges remote_range
                ON remote_range.server_id = remote_match.server_id
        ),
        normalized AS (
            SELECT
                b.id,
                b.observed_at,
                b.protocol,

                source_fqdn = CASE WHEN b.direction = 'INCOMING' THEN b.remote_fqdn ELSE b.local_fqdn END,
                source_ipv4 = CASE WHEN b.direction = 'INCOMING' THEN b.remote_address_ipv4 ELSE b.local_address_ipv4 END,
                source_mac_address = CASE WHEN b.direction = 'INCOMING' THEN b.remote_mac_address ELSE b.local_mac_address END,
                source_server_id_base = CASE WHEN b.direction = 'INCOMING' THEN b.remote_server_id ELSE b.local_server_id END,
                source_port = CASE WHEN b.direction = 'INCOMING' THEN b.remote_port ELSE b.local_port END,

                target_fqdn = CASE WHEN b.direction = 'INCOMING' THEN b.local_fqdn ELSE b.remote_fqdn END,
                target_ipv4 = CASE WHEN b.direction = 'INCOMING' THEN b.local_address_ipv4 ELSE b.remote_address_ipv4 END,
                target_mac_address = CASE WHEN b.direction = 'INCOMING' THEN b.local_mac_address ELSE b.remote_mac_address END,
                target_server_id_base = CASE WHEN b.direction = 'INCOMING' THEN b.local_server_id ELSE b.remote_server_id END,
                target_port = CASE WHEN b.direction = 'INCOMING' THEN b.local_port ELSE b.remote_port END,

                source_ephemeral_port_start = CASE WHEN b.direction = 'INCOMING' THEN b.remote_ephemeral_port_start ELSE b.local_ephemeral_port_start END,
                source_ephemeral_port_end = CASE WHEN b.direction = 'INCOMING' THEN b.remote_ephemeral_port_end ELSE b.local_ephemeral_port_end END,
                target_ephemeral_port_start = CASE WHEN b.direction = 'INCOMING' THEN b.local_ephemeral_port_start ELSE b.remote_ephemeral_port_start END,
                target_ephemeral_port_end = CASE WHEN b.direction = 'INCOMING' THEN b.local_ephemeral_port_end ELSE b.remote_ephemeral_port_end END,

                endpoint_a_process_name = CASE WHEN b.direction = 'INCOMING' THEN NULL ELSE b.process_name END,
                endpoint_a_process_id = CASE WHEN b.direction = 'INCOMING' THEN NULL ELSE b.process_id END,
                endpoint_b_process_name = CASE WHEN b.direction = 'INCOMING' THEN b.process_name ELSE NULL END,
                endpoint_b_process_id = CASE WHEN b.direction = 'INCOMING' THEN b.process_id ELSE NULL END
            FROM raw_base b
        ),
        normalized_resolved AS (
            SELECT
                n.id,
                n.observed_at,
                n.protocol,
                n.source_fqdn,
                n.source_ipv4,
                n.source_mac_address,
                source_server_id = COALESCE(src_node.server_id, n.source_server_id_base),
                n.source_port,
                n.target_fqdn,
                n.target_ipv4,
                n.target_mac_address,
                target_server_id = COALESCE(tgt_node.server_id, n.target_server_id_base),
                n.target_port,
                n.source_ephemeral_port_start,
                n.source_ephemeral_port_end,
                n.target_ephemeral_port_start,
                n.target_ephemeral_port_end,
                n.endpoint_a_process_name,
                n.endpoint_a_process_id,
                n.endpoint_b_process_name,
                n.endpoint_b_process_id
            FROM normalized n
            LEFT JOIN managed_lookup src_node
                ON src_node.fqdn = n.source_fqdn
            LEFT JOIN managed_lookup tgt_node
                ON tgt_node.fqdn = n.target_fqdn
        ),
        keyed AS (
            SELECT
                n.*,
                source_is_ephemeral = CASE WHEN n.source_port BETWEEN n.source_ephemeral_port_start AND n.source_ephemeral_port_end THEN 1 ELSE 0 END,
                target_is_ephemeral = CASE WHEN n.target_port BETWEEN n.target_ephemeral_port_start AND n.target_ephemeral_port_end THEN 1 ELSE 0 END,
                service_port =
                    CASE
                        WHEN n.source_port IS NULL AND n.target_port IS NULL THEN NULL
                        WHEN n.source_port IS NULL THEN n.target_port
                        WHEN n.target_port IS NULL THEN n.source_port
                        WHEN n.source_port BETWEEN n.source_ephemeral_port_start AND n.source_ephemeral_port_end
                         AND n.target_port NOT BETWEEN n.target_ephemeral_port_start AND n.target_ephemeral_port_end
                        THEN n.target_port
                        WHEN n.target_port BETWEEN n.target_ephemeral_port_start AND n.target_ephemeral_port_end
                         AND n.source_port NOT BETWEEN n.source_ephemeral_port_start AND n.source_ephemeral_port_end
                        THEN n.source_port
                        ELSE n.target_port
                    END
            FROM normalized_resolved n
        ),
        ranked AS (
            SELECT
                k.*,
                rn_a = ROW_NUMBER() OVER (
                    PARTITION BY
                        k.source_fqdn,
                        k.source_ipv4,
                        ISNULL(k.source_mac_address, ''),
                        k.target_fqdn,
                        k.target_ipv4,
                        ISNULL(k.target_mac_address, ''),
                        k.protocol,
                        ISNULL(k.service_port, -1)
                    ORDER BY
                        CASE WHEN k.endpoint_a_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        k.observed_at DESC,
                        k.id DESC
                ),
                rn_b = ROW_NUMBER() OVER (
                    PARTITION BY
                        k.source_fqdn,
                        k.source_ipv4,
                        ISNULL(k.source_mac_address, ''),
                        k.target_fqdn,
                        k.target_ipv4,
                        ISNULL(k.target_mac_address, ''),
                        k.protocol,
                        ISNULL(k.service_port, -1)
                    ORDER BY
                        CASE WHEN k.endpoint_b_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        k.observed_at DESC,
                        k.id DESC
                )
            FROM keyed k
        ),
        aggregated AS (
            SELECT
                endpoint_a_fqdn = source_fqdn,
                endpoint_a_ipv4 = source_ipv4,
                endpoint_a_mac_address = source_mac_address,
                endpoint_a_server_id = MAX(source_server_id),

                endpoint_b_fqdn = target_fqdn,
                endpoint_b_ipv4 = target_ipv4,
                endpoint_b_mac_address = target_mac_address,
                endpoint_b_server_id = MAX(target_server_id),

                protocol,
                service_port,

                seen_count = COUNT_BIG(*),
                first_seen = MIN(observed_at),
                last_seen = MAX(observed_at),

                endpoint_a_process_name = MAX(CASE WHEN rn_a = 1 THEN endpoint_a_process_name END),
                endpoint_a_process_id = MAX(CASE WHEN rn_a = 1 THEN endpoint_a_process_id END),
                endpoint_b_process_name = MAX(CASE WHEN rn_b = 1 THEN endpoint_b_process_name END),
                endpoint_b_process_id = MAX(CASE WHEN rn_b = 1 THEN endpoint_b_process_id END),

                endpoint_a_process_samples = SUM(CASE WHEN endpoint_a_process_name IS NOT NULL THEN 1 ELSE 0 END),
                endpoint_b_process_samples = SUM(CASE WHEN endpoint_b_process_name IS NOT NULL THEN 1 ELSE 0 END)
            FROM ranked
            GROUP BY
                source_fqdn,
                source_ipv4,
                source_mac_address,
                target_fqdn,
                target_ipv4,
                target_mac_address,
                protocol,
                service_port
        ),
        source_rows AS (
            SELECT
                a.endpoint_a_fqdn,
                a.endpoint_a_ipv4,
                a.endpoint_a_mac_address,
                a.endpoint_a_server_id,
                a.endpoint_a_process_name,
                a.endpoint_a_process_id,

                a.endpoint_b_fqdn,
                a.endpoint_b_ipv4,
                a.endpoint_b_mac_address,
                a.endpoint_b_server_id,
                a.endpoint_b_process_name,
                a.endpoint_b_process_id,

                a.protocol,
                a.service_port,
                a.seen_count,
                a.first_seen,
                a.last_seen,

                confidence =
                    CASE
                        WHEN a.endpoint_a_process_samples > 0 AND a.endpoint_b_process_samples > 0 THEN 95
                        WHEN a.endpoint_a_process_samples > 0 OR a.endpoint_b_process_samples > 0 THEN 40
                        ELSE 10
                    END
            FROM aggregated a
        )
        MERGE dbo.connection_edge AS target
        USING source_rows AS source
        ON target.edge_key =
            CONVERT(nvarchar(64), HASHBYTES(
                'SHA2_256',
                CONCAT(
                    LOWER(ISNULL(source.endpoint_a_fqdn, '')), '|',
                    ISNULL(source.endpoint_a_ipv4, ''), '|',
                    LOWER(ISNULL(source.endpoint_a_mac_address, '')), '|',
                    LOWER(ISNULL(source.endpoint_b_fqdn, '')), '|',
                    ISNULL(source.endpoint_b_ipv4, ''), '|',
                    LOWER(ISNULL(source.endpoint_b_mac_address, '')), '|',
                    LOWER(ISNULL(source.protocol, '')), '|',
                    ISNULL(CONVERT(nvarchar(20), source.service_port), '')
                )
            ), 2)

        WHEN MATCHED THEN
            UPDATE SET
                endpoint_a_fqdn = source.endpoint_a_fqdn,
                endpoint_a_ipv4 = source.endpoint_a_ipv4,
                endpoint_a_mac_address = source.endpoint_a_mac_address,
                endpoint_a_server_id = source.endpoint_a_server_id,
                endpoint_a_process_name = COALESCE(source.endpoint_a_process_name, target.endpoint_a_process_name),
                endpoint_a_process_id = COALESCE(source.endpoint_a_process_id, target.endpoint_a_process_id),
                endpoint_b_fqdn = source.endpoint_b_fqdn,
                endpoint_b_ipv4 = source.endpoint_b_ipv4,
                endpoint_b_mac_address = source.endpoint_b_mac_address,
                endpoint_b_server_id = source.endpoint_b_server_id,
                endpoint_b_process_name = COALESCE(source.endpoint_b_process_name, target.endpoint_b_process_name),
                endpoint_b_process_id = COALESCE(source.endpoint_b_process_id, target.endpoint_b_process_id),
                protocol = source.protocol,
                service_port = source.service_port,
                seen_count = source.seen_count,
                first_seen = source.first_seen,
                last_seen = source.last_seen,
                confidence = source.confidence

        WHEN NOT MATCHED THEN
            INSERT (
                endpoint_a_fqdn,
                endpoint_a_ipv4,
                endpoint_a_mac_address,
                endpoint_a_server_id,
                endpoint_a_process_name,
                endpoint_a_process_id,
                endpoint_b_fqdn,
                endpoint_b_ipv4,
                endpoint_b_mac_address,
                endpoint_b_server_id,
                endpoint_b_process_name,
                endpoint_b_process_id,
                protocol,
                service_port,
                seen_count,
                first_seen,
                last_seen,
                confidence
            )
            VALUES (
                source.endpoint_a_fqdn,
                source.endpoint_a_ipv4,
                source.endpoint_a_mac_address,
                source.endpoint_a_server_id,
                source.endpoint_a_process_name,
                source.endpoint_a_process_id,
                source.endpoint_b_fqdn,
                source.endpoint_b_ipv4,
                source.endpoint_b_mac_address,
                source.endpoint_b_server_id,
                source.endpoint_b_process_name,
                source.endpoint_b_process_id,
                source.protocol,
                source.service_port,
                source.seen_count,
                source.first_seen,
                source.last_seen,
                source.confidence
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
