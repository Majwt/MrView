USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_connection_edge
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.refresh_host_alias_map;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH latest_node_raw AS (
            SELECT
                ciid = NULLIF(LTRIM(RTRIM(nr.ciid)), ''),
                nr.ephemeral_port_start,
                nr.ephemeral_port_end,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY NULLIF(LTRIM(RTRIM(nr.ciid)), '')
                    ORDER BY nr.DateAdded DESC, nr.id DESC
                )
            FROM dbo.node_raw nr
        ),
        node_ranges AS (
            SELECT
                ciid,
                ephemeral_port_start = COALESCE(ephemeral_port_start, 49152),
                ephemeral_port_end = COALESCE(ephemeral_port_end, 65535)
            FROM latest_node_raw
            WHERE rn = 1
        ),
        managed_lookup AS (
            SELECT
                ciid = NULLIF(LTRIM(RTRIM(ciid)), ''),
                fqdn = LOWER(LTRIM(RTRIM(fqdn))),
                short_name = LOWER(
                    CASE
                        WHEN CHARINDEX('.', LTRIM(RTRIM(fqdn))) > 0
                        THEN LEFT(LTRIM(RTRIM(fqdn)), CHARINDEX('.', LTRIM(RTRIM(fqdn))) - 1)
                        ELSE LTRIM(RTRIM(fqdn))
                    END
                )
            FROM dbo.managed_node
            WHERE NULLIF(LTRIM(RTRIM(fqdn)), '') IS NOT NULL
        ),
        interface_lookup AS (
            SELECT
                ciid = NULLIF(LTRIM(RTRIM(ni.ciid)), ''),
                ni.address_ipv4,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY ni.address_ipv4
                    ORDER BY ni.last_seen DESC
                )
            FROM dbo.node_interface ni
            WHERE ni.address_ipv4 IS NOT NULL
              AND ni.address_ipv4 <> ''
        ),
        alias_lookup AS (
            SELECT
                alias_name = LOWER(alias_name),
                canonical_fqdn = LOWER(canonical_fqdn)
            FROM dbo.host_alias_map
        ),
        raw_base AS (
            SELECT
                r.id,
                r.DateAdded,
                direction = UPPER(LTRIM(RTRIM(ISNULL(r.direction, 'OUTGOING')))),
                protocol = LOWER(LTRIM(RTRIM(ISNULL(r.protocol, 'tcp')))),

                source_fqdn_raw = COALESCE(source_alias.canonical_fqdn, LOWER(COALESCE(source_match.fqdn, r.source_fqdn))),
                r.source_address_ipv4,
                source_ciid_raw = NULLIF(LTRIM(RTRIM(r.reporter_ciid)), ''),
                reporter_ciid = NULLIF(LTRIM(RTRIM(r.reporter_ciid)), ''),
                source_port_raw = r.source_port,

                target_fqdn_raw = COALESCE(target_alias.canonical_fqdn, LOWER(r.target_fqdn)),
                r.target_address_ipv4,
                target_ciid_raw = CAST(NULL AS nvarchar(128)),
                target_port_raw = r.target_port,

                r.process_name,
                r.process_id,

                source_ephemeral_port_start_raw = COALESCE(source_range.ephemeral_port_start, 49152),
                source_ephemeral_port_end_raw = COALESCE(source_range.ephemeral_port_end, 65535),
                target_ephemeral_port_start_raw = 49152,
                target_ephemeral_port_end_raw = 65535
            FROM dbo.connection_raw r
            LEFT JOIN node_ranges source_range
                ON source_range.ciid = NULLIF(LTRIM(RTRIM(r.reporter_ciid)), '')
            OUTER APPLY (
                SELECT TOP (1)
                    ni.fqdn
                FROM dbo.node_interface ni
                WHERE ni.ciid = NULLIF(LTRIM(RTRIM(r.reporter_ciid)), '')
                                    AND ni.address_ipv4 = r.source_address_ipv4
                ORDER BY
                    ni.last_seen DESC
            ) source_match
            LEFT JOIN alias_lookup source_alias
                ON source_alias.alias_name = LOWER(r.source_fqdn)
            LEFT JOIN alias_lookup target_alias
                ON target_alias.alias_name = LOWER(r.target_fqdn)
        ),
        normalized AS (
            SELECT
                b.id,
                b.DateAdded,
                b.protocol,
                b.direction,
                b.process_name,
                b.process_id,
                b.reporter_ciid,

                source_fqdn = CASE WHEN b.direction = 'INCOMING' THEN b.target_fqdn_raw ELSE b.source_fqdn_raw END,
                source_ipv4 = CASE WHEN b.direction = 'INCOMING' THEN b.target_address_ipv4 ELSE b.source_address_ipv4 END,
                source_ciid_base = b.source_ciid_raw,
                source_port = CASE WHEN b.direction = 'INCOMING' THEN b.target_port_raw ELSE b.source_port_raw END,

                target_fqdn = CASE WHEN b.direction = 'INCOMING' THEN b.source_fqdn_raw ELSE b.target_fqdn_raw END,
                target_ipv4 = CASE WHEN b.direction = 'INCOMING' THEN b.source_address_ipv4 ELSE b.target_address_ipv4 END,
                target_ciid_base = b.target_ciid_raw,
                target_port = CASE WHEN b.direction = 'INCOMING' THEN b.source_port_raw ELSE b.target_port_raw END,

                source_ephemeral_port_start = CASE WHEN b.direction = 'INCOMING' THEN b.target_ephemeral_port_start_raw ELSE b.source_ephemeral_port_start_raw END,
                source_ephemeral_port_end = CASE WHEN b.direction = 'INCOMING' THEN b.target_ephemeral_port_end_raw ELSE b.source_ephemeral_port_end_raw END,
                target_ephemeral_port_start = CASE WHEN b.direction = 'INCOMING' THEN b.source_ephemeral_port_start_raw ELSE b.target_ephemeral_port_start_raw END,
                target_ephemeral_port_end = CASE WHEN b.direction = 'INCOMING' THEN b.source_ephemeral_port_end_raw ELSE b.target_ephemeral_port_end_raw END
            FROM raw_base b
        ),
        normalized_resolved AS (
            SELECT
                n.id,
                n.DateAdded,
                n.protocol,
                source_fqdn = COALESCE(src_resolved_node.fqdn, n.source_fqdn),
                n.source_ipv4,
                source_ciid = resolved.source_ciid,
                n.source_port,
                target_fqdn = COALESCE(tgt_resolved_node.fqdn, n.target_fqdn),
                n.target_ipv4,
                target_ciid = resolved.target_ciid,
                n.target_port,
                n.source_ephemeral_port_start,
                n.source_ephemeral_port_end,
                n.target_ephemeral_port_start,
                n.target_ephemeral_port_end,
                endpoint_a_process_name =
                    CASE
                        WHEN resolved.source_ciid = n.reporter_ciid
                         AND ISNULL(resolved.target_ciid, '') <> n.reporter_ciid
                        THEN n.process_name
                        WHEN resolved.target_ciid = n.reporter_ciid
                         AND ISNULL(resolved.source_ciid, '') <> n.reporter_ciid
                        THEN NULL
                        WHEN n.direction = 'INCOMING' THEN NULL
                        ELSE n.process_name
                    END,
                endpoint_a_process_id =
                    CASE
                        WHEN resolved.source_ciid = n.reporter_ciid
                         AND ISNULL(resolved.target_ciid, '') <> n.reporter_ciid
                        THEN n.process_id
                        WHEN resolved.target_ciid = n.reporter_ciid
                         AND ISNULL(resolved.source_ciid, '') <> n.reporter_ciid
                        THEN NULL
                        WHEN n.direction = 'INCOMING' THEN NULL
                        ELSE n.process_id
                    END,
                endpoint_b_process_name =
                    CASE
                        WHEN resolved.target_ciid = n.reporter_ciid
                         AND ISNULL(resolved.source_ciid, '') <> n.reporter_ciid
                        THEN n.process_name
                        WHEN resolved.source_ciid = n.reporter_ciid
                         AND ISNULL(resolved.target_ciid, '') <> n.reporter_ciid
                        THEN NULL
                        WHEN n.direction = 'INCOMING' THEN n.process_name
                        ELSE NULL
                    END,
                endpoint_b_process_id =
                    CASE
                        WHEN resolved.target_ciid = n.reporter_ciid
                         AND ISNULL(resolved.source_ciid, '') <> n.reporter_ciid
                        THEN n.process_id
                        WHEN resolved.source_ciid = n.reporter_ciid
                         AND ISNULL(resolved.target_ciid, '') <> n.reporter_ciid
                        THEN NULL
                        WHEN n.direction = 'INCOMING' THEN n.process_id
                        ELSE NULL
                    END
            FROM normalized n
            OUTER APPLY (
                SELECT TOP (1)
                    ml.ciid,
                    ml.fqdn
                FROM managed_lookup ml
                WHERE ml.fqdn = n.source_fqdn
                   OR ml.short_name = n.source_fqdn
                ORDER BY
                    CASE WHEN ml.fqdn = n.source_fqdn THEN 0 ELSE 1 END,
                    CASE WHEN ml.fqdn LIKE '%.%' THEN 0 ELSE 1 END
            ) src_node
            OUTER APPLY (
                SELECT TOP (1)
                    ml.ciid,
                    ml.fqdn
                FROM managed_lookup ml
                WHERE ml.fqdn = n.target_fqdn
                   OR ml.short_name = n.target_fqdn
                ORDER BY
                    CASE WHEN ml.fqdn = n.target_fqdn THEN 0 ELSE 1 END,
                    CASE WHEN ml.fqdn LIKE '%.%' THEN 0 ELSE 1 END
            ) tgt_node
            LEFT JOIN interface_lookup src_iface
                ON src_iface.address_ipv4 = n.source_ipv4
               AND src_iface.rn = 1
            LEFT JOIN interface_lookup tgt_iface
                ON tgt_iface.address_ipv4 = n.target_ipv4
               AND tgt_iface.rn = 1
            OUTER APPLY (
                SELECT
                    source_ciid = COALESCE(
                        src_node.ciid,
                        CASE WHEN NULLIF(LTRIM(RTRIM(n.source_fqdn)), '') IS NULL THEN src_iface.ciid END,
                        n.source_ciid_base
                    ),
                    target_ciid = COALESCE(
                        tgt_node.ciid,
                        CASE WHEN NULLIF(LTRIM(RTRIM(n.target_fqdn)), '') IS NULL THEN tgt_iface.ciid END,
                        n.target_ciid_base
                    )
            ) resolved
            LEFT JOIN managed_lookup src_resolved_node
                ON src_resolved_node.ciid = resolved.source_ciid
            LEFT JOIN managed_lookup tgt_resolved_node
                ON tgt_resolved_node.ciid = resolved.target_ciid
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
                        ELSE CASE WHEN n.source_port <= n.target_port THEN n.source_port ELSE n.target_port END
                    END
            FROM normalized_resolved n
        ),
        ranked AS (
            SELECT
                k.*,
                rn_latest = ROW_NUMBER() OVER (
                    PARTITION BY
                        k.source_fqdn,
                        k.source_ipv4,
                        k.target_fqdn,
                        k.target_ipv4,
                        k.protocol,
                        ISNULL(k.service_port, -1)
                    ORDER BY
                        k.DateAdded DESC,
                        k.id DESC
                ),
                rn_a = ROW_NUMBER() OVER (
                    PARTITION BY
                        k.source_fqdn,
                        k.source_ipv4,
                        k.target_fqdn,
                        k.target_ipv4,
                        k.protocol,
                        ISNULL(k.service_port, -1)
                    ORDER BY
                        CASE WHEN k.endpoint_a_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        k.DateAdded DESC,
                        k.id DESC
                ),
                rn_b = ROW_NUMBER() OVER (
                    PARTITION BY
                        k.source_fqdn,
                        k.source_ipv4,
                        k.target_fqdn,
                        k.target_ipv4,
                        k.protocol,
                        ISNULL(k.service_port, -1)
                    ORDER BY
                        CASE WHEN k.endpoint_b_process_name IS NOT NULL THEN 0 ELSE 1 END,
                        k.DateAdded DESC,
                        k.id DESC
                )
            FROM keyed k
        ),
        aggregated AS (
            SELECT
                endpoint_a_fqdn = source_fqdn,
                endpoint_a_ipv4 = source_ipv4,
                endpoint_a_port = MAX(CASE WHEN rn_latest = 1 THEN source_port END),
                endpoint_a_ciid = MAX(source_ciid),

                endpoint_b_fqdn = target_fqdn,
                endpoint_b_ipv4 = target_ipv4,
                endpoint_b_port = MAX(CASE WHEN rn_latest = 1 THEN target_port END),
                endpoint_b_ciid = MAX(target_ciid),

                protocol,
                service_port,

                seen_count = COUNT_BIG(*),
                first_seen = MIN(DateAdded),
                last_seen = MAX(DateAdded),

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
                target_fqdn,
                target_ipv4,
                protocol,
                service_port
        ),
        source_rows AS (
            SELECT
                a.endpoint_a_fqdn,
                a.endpoint_a_ipv4,
                a.endpoint_a_port,
                a.endpoint_a_ciid,
                endpoint_a_process_name = COALESCE(a.endpoint_a_process_name, rev.endpoint_b_process_name),
                endpoint_a_process_id = COALESCE(a.endpoint_a_process_id, rev.endpoint_b_process_id),

                a.endpoint_b_fqdn,
                a.endpoint_b_ipv4,
                a.endpoint_b_port,
                a.endpoint_b_ciid,
                endpoint_b_process_name = COALESCE(a.endpoint_b_process_name, rev.endpoint_a_process_name),
                endpoint_b_process_id = COALESCE(a.endpoint_b_process_id, rev.endpoint_a_process_id),

                a.protocol,
                a.service_port,
                service_name = COALESCE(port_lookup.service_name, 'Unknown'),
                a.seen_count,
                a.first_seen,
                a.last_seen,

                confidence =
                    CASE
                                                WHEN (a.endpoint_a_process_samples > 0 OR ISNULL(rev.endpoint_b_process_samples, 0) > 0)
                                                 AND (a.endpoint_b_process_samples > 0 OR ISNULL(rev.endpoint_a_process_samples, 0) > 0)
                        THEN 95
                                                WHEN (a.endpoint_a_process_samples > 0 OR ISNULL(rev.endpoint_b_process_samples, 0) > 0)
                                                    OR (a.endpoint_b_process_samples > 0 OR ISNULL(rev.endpoint_a_process_samples, 0) > 0)
                        THEN 40
                        ELSE 10
                    END
            FROM aggregated a
            LEFT JOIN aggregated rev
                ON rev.endpoint_a_fqdn = a.endpoint_b_fqdn
               AND rev.endpoint_a_ipv4 = a.endpoint_b_ipv4
               AND rev.endpoint_b_fqdn = a.endpoint_a_fqdn
               AND rev.endpoint_b_ipv4 = a.endpoint_a_ipv4
               AND rev.protocol = a.protocol
               AND ISNULL(rev.service_port, -1) = ISNULL(a.service_port, -1)
            OUTER APPLY (
                SELECT TOP (1)
                    p.service_name
                FROM dbo.v_ports_effective p
                WHERE p.port_number = a.service_port
                  AND (p.protocol = a.protocol OR p.protocol = 'any')
                ORDER BY
                    CASE WHEN p.protocol = a.protocol THEN 0 ELSE 1 END,
                    p.source_table DESC
            ) port_lookup
        )
        MERGE dbo.connection_edge AS target
        USING source_rows AS source
        ON target.edge_key =
            CONVERT(nvarchar(64), HASHBYTES(
                'SHA2_256',
                CONCAT(
                    LOWER(ISNULL(source.endpoint_a_fqdn, '')), '|',
                    ISNULL(source.endpoint_a_ipv4, ''), '|',
                    LOWER(ISNULL(source.endpoint_b_fqdn, '')), '|',
                    ISNULL(source.endpoint_b_ipv4, ''), '|',
                    LOWER(ISNULL(source.protocol, '')), '|',
                    ISNULL(CONVERT(nvarchar(20), source.service_port), '')
                )
            ), 2)

        WHEN MATCHED THEN
            UPDATE SET
                endpoint_a_fqdn = source.endpoint_a_fqdn,
                endpoint_a_ipv4 = source.endpoint_a_ipv4,
                endpoint_a_port = source.endpoint_a_port,
                endpoint_a_ciid = source.endpoint_a_ciid,
                endpoint_a_process_name = COALESCE(source.endpoint_a_process_name, target.endpoint_a_process_name),
                endpoint_a_process_id = COALESCE(source.endpoint_a_process_id, target.endpoint_a_process_id),
                endpoint_b_fqdn = source.endpoint_b_fqdn,
                endpoint_b_ipv4 = source.endpoint_b_ipv4,
                endpoint_b_port = source.endpoint_b_port,
                endpoint_b_ciid = source.endpoint_b_ciid,
                endpoint_b_process_name = COALESCE(source.endpoint_b_process_name, target.endpoint_b_process_name),
                endpoint_b_process_id = COALESCE(source.endpoint_b_process_id, target.endpoint_b_process_id),
                protocol = source.protocol,
                service_port = source.service_port,
                service_name = source.service_name,
                seen_count = source.seen_count,
                first_seen = source.first_seen,
                last_seen = source.last_seen,
                confidence = source.confidence

        WHEN NOT MATCHED THEN
            INSERT (
                endpoint_a_fqdn,
                endpoint_a_ipv4,
                endpoint_a_port,
                endpoint_a_ciid,
                endpoint_a_process_name,
                endpoint_a_process_id,
                endpoint_b_fqdn,
                endpoint_b_ipv4,
                endpoint_b_port,
                endpoint_b_ciid,
                endpoint_b_process_name,
                endpoint_b_process_id,
                protocol,
                service_port,
                service_name,
                seen_count,
                first_seen,
                last_seen,
                confidence
            )
            VALUES (
                source.endpoint_a_fqdn,
                source.endpoint_a_ipv4,
                source.endpoint_a_port,
                source.endpoint_a_ciid,
                source.endpoint_a_process_name,
                source.endpoint_a_process_id,
                source.endpoint_b_fqdn,
                source.endpoint_b_ipv4,
                source.endpoint_b_port,
                source.endpoint_b_ciid,
                source.endpoint_b_process_name,
                source.endpoint_b_process_id,
                source.protocol,
                source.service_port,
                source.service_name,
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
