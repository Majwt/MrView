USE AxiNetStat;
GO

CREATE OR ALTER VIEW dbo.v_debug_stats_overview
AS
SELECT 'managed_node_count' AS metric, CAST(COUNT_BIG(*) AS bigint) AS metric_value
FROM dbo.managed_node
UNION ALL
SELECT 'node_raw_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.node_raw
UNION ALL
SELECT 'node_interface_raw_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.node_interface_raw
UNION ALL
SELECT 'node_interface_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.node_interface
UNION ALL
SELECT 'connection_raw_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.connection_raw
UNION ALL
SELECT 'connection_edge_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.connection_edge
UNION ALL
SELECT 'ports_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.ports
UNION ALL
SELECT 'ports_override_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.ports_override
UNION ALL
SELECT 'ports_effective_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.v_ports_effective
UNION ALL
SELECT 'host_alias_map_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.host_alias_map
UNION ALL
SELECT 'edge_unknown_service_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.connection_edge ce
WHERE ce.service_name = 'Unknown'
UNION ALL
SELECT 'edge_missing_endpoint_a_process_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.connection_edge ce
WHERE ce.endpoint_a_process_name IS NULL
UNION ALL
SELECT 'edge_missing_endpoint_b_process_count', CAST(COUNT_BIG(*) AS bigint)
FROM dbo.connection_edge ce
WHERE ce.endpoint_b_process_name IS NULL;
GO

CREATE OR ALTER VIEW dbo.v_debug_alias_map_status
AS
WITH normalized AS (
    SELECT
                endpoint_name = LOWER(LTRIM(RTRIM(r.source_fqdn))),
                peer_name = LOWER(LTRIM(RTRIM(r.target_fqdn)))
    FROM dbo.connection_raw r
        WHERE r.source_fqdn IS NOT NULL
            AND r.target_fqdn IS NOT NULL

    UNION ALL

    SELECT
                endpoint_name = LOWER(LTRIM(RTRIM(r.target_fqdn))),
                peer_name = LOWER(LTRIM(RTRIM(r.source_fqdn)))
    FROM dbo.connection_raw r
        WHERE r.source_fqdn IS NOT NULL
            AND r.target_fqdn IS NOT NULL
),
alias_activity AS (
    SELECT
        alias_name = n.endpoint_name,
        sample_count = COUNT_BIG(*),
        distinct_peer_count = COUNT_BIG(DISTINCT n.peer_name)
    FROM normalized n
    WHERE n.endpoint_name NOT LIKE '%.%'
      AND n.peer_name LIKE '%.%'
    GROUP BY n.endpoint_name
),
candidate_counts AS (
    SELECT
        aa.alias_name,
        candidate_count = COUNT_BIG(*)
    FROM alias_activity aa
    INNER JOIN dbo.managed_node mn
        ON LEFT(LOWER(mn.fqdn), CHARINDEX('.', LOWER(mn.fqdn) + '.') - 1) = aa.alias_name
    GROUP BY aa.alias_name
)
SELECT
    aa.alias_name,
    aa.sample_count,
    aa.distinct_peer_count,
    mapped_canonical_fqdn = ham.canonical_fqdn,
    mapped_evidence_count = ham.evidence_count,
    mapped_confidence = ham.confidence,
    candidate_count = ISNULL(cc.candidate_count, 0),
    mapping_status =
        CASE
            WHEN ham.alias_name IS NOT NULL THEN 'mapped'
            WHEN ISNULL(cc.candidate_count, 0) = 0 THEN 'no_candidate'
            ELSE 'unmapped'
        END
FROM alias_activity aa
LEFT JOIN candidate_counts cc
    ON cc.alias_name = aa.alias_name
LEFT JOIN dbo.host_alias_map ham
    ON ham.alias_name = aa.alias_name;
GO

CREATE OR ALTER VIEW dbo.v_debug_alias_map_conflicts
AS
WITH normalized AS (
    SELECT
                endpoint_name = LOWER(LTRIM(RTRIM(r.source_fqdn))),
                peer_name = LOWER(LTRIM(RTRIM(r.target_fqdn))),
        protocol = LOWER(LTRIM(RTRIM(ISNULL(r.protocol, 'tcp')))),
                service_port = r.target_port
    FROM dbo.connection_raw r
        WHERE r.source_fqdn IS NOT NULL
            AND r.target_fqdn IS NOT NULL

    UNION ALL

    SELECT
                endpoint_name = LOWER(LTRIM(RTRIM(r.target_fqdn))),
                peer_name = LOWER(LTRIM(RTRIM(r.source_fqdn))),
        protocol = LOWER(LTRIM(RTRIM(ISNULL(r.protocol, 'tcp')))),
                service_port = r.source_port
    FROM dbo.connection_raw r
        WHERE r.source_fqdn IS NOT NULL
            AND r.target_fqdn IS NOT NULL
),
canonical_obs AS (
    SELECT DISTINCT
        endpoint_name,
        peer_name,
        protocol,
        service_port
    FROM normalized
    WHERE endpoint_name LIKE '%.%'
      AND peer_name LIKE '%.%'
),
alias_obs AS (
    SELECT DISTINCT
        alias_name = endpoint_name,
        peer_name,
        protocol,
        service_port
    FROM normalized
    WHERE endpoint_name NOT LIKE '%.%'
      AND peer_name LIKE '%.%'
),
candidates AS (
    SELECT DISTINCT
        a.alias_name,
        canonical_fqdn = LOWER(mn.fqdn)
    FROM alias_obs a
    INNER JOIN dbo.managed_node mn
        ON LEFT(LOWER(mn.fqdn), CHARINDEX('.', LOWER(mn.fqdn) + '.') - 1) = a.alias_name
),
scores AS (
    SELECT
        c.alias_name,
        c.canonical_fqdn,
        evidence_count = COUNT_BIG(*)
    FROM candidates c
    INNER JOIN alias_obs a
        ON a.alias_name = c.alias_name
    INNER JOIN canonical_obs o
        ON o.endpoint_name = c.canonical_fqdn
       AND o.peer_name = a.peer_name
       AND o.protocol = a.protocol
       AND ISNULL(o.service_port, -1) = ISNULL(a.service_port, -1)
    GROUP BY c.alias_name, c.canonical_fqdn
),
ranked AS (
    SELECT
        s.alias_name,
        s.canonical_fqdn,
        s.evidence_count,
        rn = ROW_NUMBER() OVER (
            PARTITION BY s.alias_name
            ORDER BY s.evidence_count DESC, s.canonical_fqdn
        )
    FROM scores s
),
top_choice AS (
    SELECT
        r.alias_name,
        top_canonical_fqdn = r.canonical_fqdn,
        top_evidence_count = r.evidence_count
    FROM ranked r
    WHERE r.rn = 1
)
SELECT
    m.alias_name,
    m.canonical_fqdn AS mapped_canonical_fqdn,
    mapped_evidence_count = ISNULL(ms.evidence_count, 0),
    m.confidence AS mapped_confidence,
    t.top_canonical_fqdn,
    t.top_evidence_count,
    conflict_reason =
        CASE
            WHEN t.alias_name IS NULL THEN 'no_score_but_mapped'
            WHEN t.top_canonical_fqdn <> m.canonical_fqdn THEN 'mapped_not_top_choice'
            WHEN m.confidence < 0.60 THEN 'low_confidence_mapping'
            ELSE 'none'
        END
FROM dbo.host_alias_map m
LEFT JOIN scores ms
    ON ms.alias_name = m.alias_name
   AND ms.canonical_fqdn = m.canonical_fqdn
LEFT JOIN top_choice t
    ON t.alias_name = m.alias_name
WHERE t.alias_name IS NULL
   OR t.top_canonical_fqdn <> m.canonical_fqdn
   OR m.confidence < 0.60;
GO

CREATE OR ALTER VIEW dbo.v_debug_connection_edge_issues
AS
SELECT
    ce.id,
    ce.endpoint_a_fqdn,
    ce.endpoint_b_fqdn,
    ce.endpoint_a_ciid,
    ce.endpoint_b_ciid,
    ce.endpoint_a_port,
    ce.endpoint_a_ipv4,
    ce.endpoint_b_port,
    ce.endpoint_b_ipv4,
    ce.protocol,
    ce.service_port,
    ce.service_name,
    ce.seen_count,
    ce.first_seen,
    ce.last_seen,
    missing_endpoint_a_process = CAST(CASE WHEN ce.endpoint_a_process_name IS NULL THEN 1 ELSE 0 END AS bit),
    missing_endpoint_b_process = CAST(CASE WHEN ce.endpoint_b_process_name IS NULL THEN 1 ELSE 0 END AS bit),
    unknown_service_name = CAST(CASE WHEN ce.service_name = 'Unknown' THEN 1 ELSE 0 END AS bit),
    endpoint_a_server_fqdn_mismatch = CAST(
        CASE
            WHEN ce.endpoint_a_ciid IS NOT NULL
             AND mna.fqdn IS NOT NULL
             AND LOWER(mna.fqdn) <> LOWER(ce.endpoint_a_fqdn)
            THEN 1 ELSE 0
        END AS bit
    ),
    endpoint_b_server_fqdn_mismatch = CAST(
        CASE
            WHEN ce.endpoint_b_ciid IS NOT NULL
             AND mnb.fqdn IS NOT NULL
             AND LOWER(mnb.fqdn) <> LOWER(ce.endpoint_b_fqdn)
            THEN 1 ELSE 0
        END AS bit
    ),
    same_ciid_different_endpoint = CAST(
        CASE
            WHEN ce.endpoint_a_ciid IS NOT NULL
             AND ce.endpoint_b_ciid IS NOT NULL
             AND ce.endpoint_a_ciid = ce.endpoint_b_ciid
             AND (
                    ISNULL(LOWER(ce.endpoint_a_fqdn), '') <> ISNULL(LOWER(ce.endpoint_b_fqdn), '')
                 OR ISNULL(ce.endpoint_a_ipv4, '') <> ISNULL(ce.endpoint_b_ipv4, '')
             )
            THEN 1 ELSE 0
        END AS bit
    )
FROM dbo.connection_edge ce
LEFT JOIN dbo.managed_node mna
    ON mna.ciid = ce.endpoint_a_ciid
LEFT JOIN dbo.managed_node mnb
    ON mnb.ciid = ce.endpoint_b_ciid;
GO

CREATE OR ALTER VIEW dbo.v_debug_connection_edge_issue_summary
AS
SELECT
    total_edges = COUNT_BIG(*),
    edges_missing_endpoint_a_process = SUM(CASE WHEN i.missing_endpoint_a_process = 1 THEN 1 ELSE 0 END),
    edges_missing_endpoint_b_process = SUM(CASE WHEN i.missing_endpoint_b_process = 1 THEN 1 ELSE 0 END),
    edges_with_any_missing_process = SUM(CASE WHEN i.missing_endpoint_a_process = 1 OR i.missing_endpoint_b_process = 1 THEN 1 ELSE 0 END),
    edges_unknown_service_name = SUM(CASE WHEN i.unknown_service_name = 1 THEN 1 ELSE 0 END),
    edges_with_server_fqdn_mismatch = SUM(CASE WHEN i.endpoint_a_server_fqdn_mismatch = 1 OR i.endpoint_b_server_fqdn_mismatch = 1 THEN 1 ELSE 0 END),
    edges_same_ciid_different_endpoint = SUM(CASE WHEN i.same_ciid_different_endpoint = 1 THEN 1 ELSE 0 END)
FROM dbo.v_debug_connection_edge_issues i;
GO

CREATE OR ALTER VIEW dbo.v_debug_connection_edge_same_ciid_conflicts
AS
SELECT
    i.id,
    i.endpoint_a_fqdn,
    i.endpoint_a_ipv4,
    i.endpoint_a_port,
    i.endpoint_a_ciid,
    i.endpoint_b_fqdn,
    i.endpoint_b_ipv4,
    i.endpoint_b_port,
    i.endpoint_b_ciid,
    i.protocol,
    i.service_port,
    i.service_name,
    i.seen_count,
    i.first_seen,
    i.last_seen
FROM dbo.v_debug_connection_edge_issues i
WHERE i.same_ciid_different_endpoint = 1;
GO
