USE AxiNetStat;
GO

-- Aggregated view over connection_edge: one row per edge with lifetime seen_count, first/last seen.
-- The API uses this view wherever current-state edge data with aggregated counts is needed.
CREATE OR ALTER VIEW dbo.v_connection_stats
AS
    WITH agg AS (
        SELECT
            edge_key,
            id         = MAX(id),
            seen_count = COUNT_BIG(*),
            first_seen = CAST(MIN(observed_date) AS datetime2(0)),
            last_seen  = CAST(MAX(observed_date) AS datetime2(0))
        FROM dbo.connection_edge
        GROUP BY edge_key
    )
    SELECT
        a.id,
        ce.endpoint_a_fqdn,
        ce.endpoint_a_ipv4,
        ce.endpoint_a_port,
        ce.endpoint_a_ciid,
        ce.endpoint_a_process_name,
        ce.endpoint_a_process_id,
        ce.endpoint_b_fqdn,
        ce.endpoint_b_ipv4,
        ce.endpoint_b_port,
        ce.endpoint_b_ciid,
        ce.endpoint_b_process_name,
        ce.endpoint_b_process_id,
        ce.protocol,
        ce.service_port,
        ce.service_name,
        ce.confidence,
        ce.edge_key,
        a.seen_count,
        a.first_seen,
        a.last_seen
    FROM agg a
    JOIN dbo.connection_edge ce ON ce.id = a.id;
GO
