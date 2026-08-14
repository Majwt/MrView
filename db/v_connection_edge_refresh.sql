USE AxiNetStat;
GO

-- Preview rowset for dbo.refresh_connection_edge.
-- This view returns the same columns and transformation results as the
-- procedure's final INSERT ... SELECT, without writing to dbo.connection_edge.
CREATE OR ALTER VIEW dbo.v_connection_edge_refresh
AS
    WITH latest_node_raw AS (
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
    refresh_window AS (
        SELECT
            raw_cutoff = DATEADD(
                DAY,
                -1,
                COALESCE(MAX(observed_at), CONVERT(datetime2(0), '1900-01-01'))
            )
        FROM dbo.connection_edge
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
        CROSS JOIN refresh_window rw
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
        WHERE r.DateAdded >= rw.raw_cutoff
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
            source_fqdn = b.source_fqdn_raw,
            source_ipv4 = b.source_address_ipv4,
            source_ciid_base = CASE WHEN b.direction = 'INCOMING' THEN NULL               ELSE b.source_ciid_raw  END,
            source_port = b.source_port_raw,
            target_fqdn = b.target_fqdn_raw,
            target_ipv4 = b.target_address_ipv4,
            target_ciid_base = CASE WHEN b.direction = 'INCOMING' THEN b.reporter_ciid    ELSE b.target_ciid_raw  END,
            target_port = b.target_port_raw,
            source_ephemeral_port_start = CASE WHEN b.direction = 'INCOMING' THEN 49152 ELSE b.source_ephemeral_port_start_raw END,
            source_ephemeral_port_end   = CASE WHEN b.direction = 'INCOMING' THEN 65535 ELSE b.source_ephemeral_port_end_raw   END,
            target_ephemeral_port_start = b.target_ephemeral_port_start_raw,
            target_ephemeral_port_end   = b.target_ephemeral_port_end_raw
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
               OR (ml.short_name = n.source_fqdn AND EXISTS (
                   SELECT 1 FROM dbo.node_interface ni
                   WHERE ni.ciid = ml.ciid AND ni.address_ipv4 = n.source_ipv4
               ))
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
               OR (ml.short_name = n.target_fqdn AND EXISTS (
                   SELECT 1 FROM dbo.node_interface ni
                   WHERE ni.ciid = ml.ciid AND ni.address_ipv4 = n.target_ipv4
               ))
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
    -- service_port is always the target (server) port
    keyed AS (
        SELECT
            n.*,
            service_port = n.target_port
        FROM normalized_resolved n
    ),
    source_rows AS (
            SELECT
                k.source_fqdn,
                k.source_ipv4,
                k.source_port,
                k.source_ciid,
                k.endpoint_a_process_name,
                k.endpoint_a_process_id,
                k.target_fqdn,
                k.target_ipv4,
                k.target_port,
                k.target_ciid,
                k.endpoint_b_process_name,
                k.endpoint_b_process_id,
                k.protocol,
                k.service_port,
                service_name = COALESCE(ps.service_name, 'Unknown'),
                k.DateAdded
            FROM keyed k
            OUTER APPLY (
                SELECT TOP (1)
                    p.service_name
                FROM dbo.v_ports_effective p
                WHERE p.port_number = k.service_port
                  AND (p.protocol = k.protocol OR p.protocol = 'any')
                ORDER BY
                    CASE WHEN p.protocol = k.protocol THEN 0 ELSE 1 END,
                    p.source_table DESC
            ) ps
        ),
        paired AS (
            SELECT
                source_fqdn             = o.source_fqdn,
                source_ipv4             = o.source_ipv4,
                source_port             = o.source_port,
                source_ciid             = COALESCE(o.source_ciid,             i.source_ciid),
                endpoint_a_process_name = COALESCE(o.endpoint_a_process_name, i.endpoint_a_process_name),
                endpoint_a_process_id   = COALESCE(o.endpoint_a_process_id,   i.endpoint_a_process_id),
                target_fqdn             = o.target_fqdn,
                target_ipv4             = o.target_ipv4,
                target_port             = o.target_port,
                target_ciid             = COALESCE(o.target_ciid,             i.target_ciid),
                endpoint_b_process_name = COALESCE(o.endpoint_b_process_name, i.endpoint_b_process_name),
                endpoint_b_process_id   = COALESCE(o.endpoint_b_process_id,   i.endpoint_b_process_id),
                o.protocol,
                o.service_port,
                service_name            = CASE WHEN o.service_name <> 'Unknown' THEN o.service_name ELSE COALESCE(i.service_name, o.service_name) END,
                DateAdded               = CASE WHEN i.DateAdded > o.DateAdded THEN i.DateAdded ELSE o.DateAdded END
            FROM source_rows o
            OUTER APPLY (
                SELECT TOP (1)
                    i2.source_ciid, i2.endpoint_a_process_name, i2.endpoint_a_process_id,
                    i2.target_ciid, i2.endpoint_b_process_name, i2.endpoint_b_process_id,
                    i2.service_name, i2.DateAdded
                FROM source_rows i2
                WHERE i2.source_fqdn = o.source_fqdn AND i2.source_ipv4 = o.source_ipv4
                  AND i2.source_port = o.source_port AND i2.target_fqdn = o.target_fqdn
                  AND i2.target_ipv4 = o.target_ipv4 AND i2.target_port = o.target_port
                  AND i2.protocol    = o.protocol
                  AND (
                        (o.endpoint_a_process_name IS NOT NULL AND i2.endpoint_b_process_name IS NOT NULL)
                     OR (o.endpoint_b_process_name IS NOT NULL AND i2.endpoint_a_process_name IS NOT NULL)
                  )
                  AND ABS(DATEDIFF(second, o.DateAdded, i2.DateAdded)) <= 120
                ORDER BY ABS(DATEDIFF(second, o.DateAdded, i2.DateAdded))
            ) i
            WHERE o.endpoint_a_process_name IS NOT NULL
               OR o.endpoint_b_process_name IS NOT NULL
               OR NOT EXISTS (
                    SELECT 1 FROM source_rows i3
                    WHERE i3.source_fqdn = o.source_fqdn AND i3.source_ipv4 = o.source_ipv4
                      AND i3.source_port = o.source_port AND i3.target_fqdn = o.target_fqdn
                      AND i3.target_ipv4 = o.target_ipv4 AND i3.target_port = o.target_port
                      AND i3.protocol    = o.protocol
                      AND i3.DateAdded  <> o.DateAdded
                      AND ABS(DATEDIFF(second, o.DateAdded, i3.DateAdded)) <= 120
               )
        ),
        merged_rows AS (
            SELECT
                source_fqdn,
                source_ipv4,
                source_port             = MAX(source_port),
                source_ciid             = MAX(source_ciid),
                endpoint_a_process_name = MAX(endpoint_a_process_name),
                endpoint_a_process_id   = MAX(endpoint_a_process_id),
                target_fqdn,
                target_ipv4,
                target_port             = MAX(target_port),
                target_ciid             = MAX(target_ciid),
                endpoint_b_process_name = MAX(endpoint_b_process_name),
                endpoint_b_process_id   = MAX(endpoint_b_process_id),
                protocol,
                service_port,
                service_name            = MAX(service_name),
                DateAdded               = MAX(DateAdded)
            FROM paired
            GROUP BY
                source_fqdn, source_ipv4, source_port,
                target_fqdn, target_ipv4, target_port,
                protocol, service_port,
                CAST(DateAdded AS date)
        )
    SELECT
        endpoint_a_fqdn = source_fqdn,
        endpoint_a_ipv4 = source_ipv4,
        endpoint_a_port = source_port,
        endpoint_a_ciid = source_ciid,
        endpoint_a_process_name,
        endpoint_a_process_id,
        endpoint_b_fqdn = target_fqdn,
        endpoint_b_ipv4 = target_ipv4,
        endpoint_b_port = target_port,
        endpoint_b_ciid = target_ciid,
        endpoint_b_process_name,
        endpoint_b_process_id,
        protocol,
        service_port,
        service_name,
        confidence = CASE
            WHEN endpoint_a_process_name IS NOT NULL AND endpoint_b_process_name IS NOT NULL THEN 95
            WHEN endpoint_a_process_name IS NOT NULL OR  endpoint_b_process_name IS NOT NULL THEN 40
            ELSE 10
        END,
        observed_at = DateAdded
    FROM merged_rows;
GO