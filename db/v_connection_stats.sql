USE AxiNetStat;
GO

-- Aggregated view over connection_edge: one row per logical edge with lifetime seen_count, first/last seen.
-- LSASS dynamic RPC ports (>=49152, process=lsass.exe) group into one stats row per endpoint pair/protocol;
-- port 135 (RPC endpoint mapper) remains its own row.
-- Representative row is the highest-confidence occurrence; ties broken by MAX(id).
CREATE OR ALTER VIEW dbo.v_connection_stats
AS
    WITH
    -- remap dynamic lsass RPC target ports to NULL for stats grouping only
    lsass_normalized AS (
        SELECT
            ce.id,
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
            ce.observed_at,
            ce.edge_key,
            -- stats_service_port groups dynamic lsass RPC under NULL; everything else keeps its port
            stats_service_port = CASE
                WHEN LOWER(ce.endpoint_b_process_name) = 'lsass.exe'
                 AND ce.service_port >= 49152
                THEN NULL
                ELSE ce.service_port
            END
        FROM dbo.connection_edge ce
    ),
    -- compute a stable stats key from endpoint FQDNs/IPs, protocol, and the normalised port
    keyed AS (
        SELECT
            ln.*,
            stats_key = CONVERT(nvarchar(64), HASHBYTES(
                'SHA2_256',
                CONCAT(
                    LOWER(ISNULL(ln.endpoint_a_fqdn, '')), '|',
                    ISNULL(ln.endpoint_a_ipv4, ''), '|',
                    LOWER(ISNULL(ln.endpoint_b_fqdn, '')), '|',
                    ISNULL(ln.endpoint_b_ipv4, ''), '|',
                    LOWER(ISNULL(ln.protocol, '')), '|',
                    ISNULL(CONVERT(nvarchar(20), ln.stats_service_port), '')
                )
            ), 2)
        FROM lsass_normalized ln
    ),
    agg AS (
        SELECT
            stats_key,
            -- prefer the row with the most process information, then latest insert
            id         = MAX(CASE WHEN confidence = 95 THEN id END),
            id_any     = MAX(id),
            seen_count = COUNT_BIG(*),
            first_seen = MIN(observed_at),
            last_seen  = MAX(observed_at)
        FROM keyed
        GROUP BY stats_key
    )
    SELECT
        a.stats_key  AS edge_key,
        ce.id,
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
        a.seen_count,
        a.first_seen,
        a.last_seen
    FROM agg a
    JOIN dbo.connection_edge ce ON ce.id = COALESCE(a.id, a.id_any);
GO
