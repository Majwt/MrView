USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_host_alias_map
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    ;WITH normalized AS (
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
    canonical_hosts AS (
        SELECT canonical_fqdn = LOWER(mn.fqdn)
        FROM dbo.managed_node mn
        WHERE mn.fqdn IS NOT NULL
    ),
    candidates AS (
        SELECT DISTINCT
            a.alias_name,
            ch.canonical_fqdn
        FROM alias_obs a
        INNER JOIN canonical_hosts ch
            ON LEFT(ch.canonical_fqdn, CHARINDEX('.', ch.canonical_fqdn + '.') - 1) = a.alias_name
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
        GROUP BY
            c.alias_name,
            c.canonical_fqdn
    ),
    candidate_counts AS (
        SELECT
            alias_name,
            candidate_count = COUNT(*)
        FROM candidates
        GROUP BY alias_name
    ),
    alias_activity AS (
        SELECT
            alias_name,
            evidence_count = COUNT_BIG(*)
        FROM alias_obs
        GROUP BY alias_name
    ),
    ranked AS (
        SELECT
            s.alias_name,
            s.canonical_fqdn,
            s.evidence_count,
            rn = ROW_NUMBER() OVER (
                PARTITION BY s.alias_name
                ORDER BY s.evidence_count DESC, s.canonical_fqdn
            ),
            next_evidence = LEAD(s.evidence_count) OVER (
                PARTITION BY s.alias_name
                ORDER BY s.evidence_count DESC, s.canonical_fqdn
            )
        FROM scores s
    ),
    winners AS (
        SELECT
            r.alias_name,
            r.canonical_fqdn,
            r.evidence_count,
            confidence =
                CASE
                    WHEN r.next_evidence IS NULL THEN CAST(1.0000 AS decimal(9,4))
                    WHEN r.evidence_count = 0 THEN CAST(0.0000 AS decimal(9,4))
                    ELSE CAST((r.evidence_count * 1.0) / NULLIF(r.next_evidence, 0) AS decimal(9,4))
                END
        FROM ranked r
        WHERE r.rn = 1
                    AND r.evidence_count >= 2
          AND (r.next_evidence IS NULL OR r.evidence_count >= (r.next_evidence * 2))
    ),
    unique_hostname_fallback AS (
        SELECT
            c.alias_name,
            c.canonical_fqdn,
            aa.evidence_count,
            confidence = CAST(0.5000 AS decimal(9,4))
        FROM candidates c
        INNER JOIN candidate_counts cc
            ON cc.alias_name = c.alias_name
           AND cc.candidate_count = 1
        INNER JOIN alias_activity aa
            ON aa.alias_name = c.alias_name
        LEFT JOIN scores s
            ON s.alias_name = c.alias_name
           AND s.canonical_fqdn = c.canonical_fqdn
        WHERE s.alias_name IS NULL
                    AND aa.evidence_count >= 1
    ),
    final_winners AS (
        SELECT alias_name, canonical_fqdn, evidence_count, confidence
        FROM winners
        UNION ALL
        SELECT f.alias_name, f.canonical_fqdn, f.evidence_count, f.confidence
        FROM unique_hostname_fallback f
        WHERE NOT EXISTS (
            SELECT 1
            FROM winners w
            WHERE w.alias_name = f.alias_name
        )
    )
    MERGE dbo.host_alias_map AS target
    USING final_winners AS source
    ON target.alias_name = source.alias_name
    WHEN MATCHED THEN
        UPDATE SET
            canonical_fqdn = source.canonical_fqdn,
            evidence_count = source.evidence_count,
            confidence = source.confidence,
            updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (alias_name, canonical_fqdn, evidence_count, confidence)
        VALUES (source.alias_name, source.canonical_fqdn, source.evidence_count, source.confidence)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;
END;
GO
