USE AxiNetStat;
GO

/*
Basic post-refresh check:
- Find destination endpoint names that are not FQDNs.
- Try to match each destination short name to source FQDNs using LIKE.
*/
CREATE OR ALTER VIEW dbo.v_debug_non_fqdn_destination_source_matches
AS
WITH non_fqdn_destinations AS (
    SELECT
        destination_name = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))),
        destination_seen_count = COUNT_BIG(*),
        destination_edge_count = COUNT_BIG(*),
        first_seen = CAST(MIN(ce.observed_date) AS datetime2(0)),
        last_seen  = CAST(MAX(ce.observed_date) AS datetime2(0))
    FROM dbo.connection_edge ce
    WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_b_fqdn)), '') IS NOT NULL
      AND ce.endpoint_b_fqdn NOT LIKE '%.%'
    GROUP BY LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
),
source_fqdn_candidates AS (
    SELECT DISTINCT
        source_fqdn = LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn)))
    FROM dbo.connection_edge ce
    WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_a_fqdn)), '') IS NOT NULL
      AND ce.endpoint_a_fqdn LIKE '%.%'
),
node_lookup AS (
    SELECT
        node_ciid = mn.ciid,
        node_fqdn = LOWER(LTRIM(RTRIM(mn.fqdn))),
        node_is_active = mn.is_active,
        node_group_name = mn.group_name,
        node_last_seen = mn.last_seen
    FROM dbo.managed_node mn
    WHERE NULLIF(LTRIM(RTRIM(mn.fqdn)), '') IS NOT NULL
)
SELECT
    d.destination_name,
    d.destination_seen_count,
    d.destination_edge_count,
    d.first_seen,
    d.last_seen,
    s.source_fqdn AS source_fqdn_candidate,
    n.node_ciid,
    n.node_fqdn,
    n.node_is_active,
    n.node_group_name,
    n.node_last_seen,
    match_type = CASE
        WHEN s.source_fqdn IS NULL THEN 'no_match'
        WHEN s.source_fqdn = d.destination_name THEN 'exact'
        WHEN s.source_fqdn LIKE d.destination_name + '.%' THEN 'prefix'
        ELSE 'like'
    END
FROM non_fqdn_destinations d
LEFT JOIN source_fqdn_candidates s
    ON s.source_fqdn LIKE d.destination_name + '.%'
LEFT JOIN node_lookup n
    ON n.node_fqdn = s.source_fqdn

GO
