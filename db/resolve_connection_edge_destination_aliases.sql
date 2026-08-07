USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.resolve_connection_edge_destination_aliases
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @updated_rows int = 0;

    ;WITH alias_rows AS (
        SELECT
            destination_alias = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))),
            source_fqdn = LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))),
            evidence = 1
        FROM dbo.connection_edge ce
        WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_b_fqdn)), '') IS NOT NULL
          AND ce.endpoint_b_fqdn NOT LIKE '%.%'
          AND NULLIF(LTRIM(RTRIM(ce.endpoint_a_fqdn)), '') IS NOT NULL
          AND ce.endpoint_a_fqdn LIKE '%.%'
          AND (
                LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))) = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
             OR LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))) LIKE LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))) + '.%'
             OR LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))) LIKE '%.' + LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))) + '.%'
             OR LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))) LIKE '%.' + LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
          )
    ),
    scores AS (
        SELECT
            ar.destination_alias,
            ar.source_fqdn,
            evidence_count = SUM(ar.evidence)
        FROM alias_rows ar
        GROUP BY
            ar.destination_alias,
            ar.source_fqdn
    ),
    scored_nodes AS (
        SELECT
            s.destination_alias,
            node_fqdn = LOWER(LTRIM(RTRIM(mn.fqdn))),
            node_ciid = mn.ciid,
            s.evidence_count,
            rn = ROW_NUMBER() OVER (
                PARTITION BY s.destination_alias
                ORDER BY s.evidence_count DESC, LOWER(LTRIM(RTRIM(mn.fqdn)))
            )
        FROM scores s
        INNER JOIN dbo.managed_node mn
            ON LOWER(LTRIM(RTRIM(mn.fqdn))) = s.source_fqdn
    ),
    evidence_winners AS (
        SELECT
            sn.destination_alias,
            sn.node_fqdn,
            sn.node_ciid
        FROM scored_nodes sn
        WHERE sn.rn = 1
    ),
    source_pool AS (
        SELECT
            source_fqdn = LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn))),
            evidence_count = COUNT_BIG(*)
        FROM dbo.connection_edge ce
        WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_a_fqdn)), '') IS NOT NULL
          AND ce.endpoint_a_fqdn LIKE '%.%'
        GROUP BY LOWER(LTRIM(RTRIM(ce.endpoint_a_fqdn)))
    ),
    global_source_candidates AS (
        SELECT
            destination_alias = d.destination_alias,
            sp.source_fqdn,
            sp.evidence_count,
            rn = ROW_NUMBER() OVER (
                PARTITION BY d.destination_alias
                ORDER BY sp.evidence_count DESC, sp.source_fqdn
            )
        FROM (
            SELECT DISTINCT
                destination_alias = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
            FROM dbo.connection_edge ce
            WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_b_fqdn)), '') IS NOT NULL
              AND ce.endpoint_b_fqdn NOT LIKE '%.%'
        ) d
        INNER JOIN source_pool sp
            ON (
                   sp.source_fqdn = d.destination_alias
                OR sp.source_fqdn LIKE d.destination_alias + '.%'
                OR sp.source_fqdn LIKE '%.' + d.destination_alias + '.%'
                OR sp.source_fqdn LIKE '%.' + d.destination_alias
            )
    ),
    global_source_winners AS (
        SELECT
            gsc.destination_alias,
            node_fqdn = LOWER(LTRIM(RTRIM(mn.fqdn))),
            node_ciid = mn.ciid
        FROM global_source_candidates gsc
        INNER JOIN dbo.managed_node mn
            ON LOWER(LTRIM(RTRIM(mn.fqdn))) = gsc.source_fqdn
        WHERE gsc.rn = 1
    ),
    map_winners AS (
        SELECT
            destination_alias = LOWER(LTRIM(RTRIM(ham.alias_name))),
            node_fqdn = LOWER(LTRIM(RTRIM(ham.canonical_fqdn))),
            node_ciid = mn.ciid
        FROM dbo.host_alias_map ham
        LEFT JOIN dbo.managed_node mn
            ON LOWER(LTRIM(RTRIM(mn.fqdn))) = LOWER(LTRIM(RTRIM(ham.canonical_fqdn)))
        WHERE NULLIF(LTRIM(RTRIM(ham.alias_name)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(ham.canonical_fqdn)), '') IS NOT NULL
          AND ham.canonical_fqdn LIKE '%.%'
    ),
    short_name_candidates AS (
        SELECT
            destination_alias = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))),
            node_fqdn = LOWER(LTRIM(RTRIM(mn.fqdn))),
            node_ciid = mn.ciid,
            rn = ROW_NUMBER() OVER (
                PARTITION BY LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
                ORDER BY LOWER(LTRIM(RTRIM(mn.fqdn)))
            ),
            candidate_count = COUNT(*) OVER (
                PARTITION BY LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
            )
        FROM dbo.connection_edge ce
        INNER JOIN dbo.managed_node mn
            ON LEFT(LOWER(LTRIM(RTRIM(mn.fqdn))), CHARINDEX('.', LOWER(LTRIM(RTRIM(mn.fqdn))) + '.') - 1)
               = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
        WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_b_fqdn)), '') IS NOT NULL
          AND ce.endpoint_b_fqdn NOT LIKE '%.%'
    ),
    fallback_winners AS (
        SELECT
            sc.destination_alias,
            sc.node_fqdn,
            sc.node_ciid
        FROM short_name_candidates sc
        WHERE sc.rn = 1
          AND sc.candidate_count = 1
    ),
    winners AS (
        SELECT
            ew.destination_alias,
            ew.node_fqdn,
            ew.node_ciid
        FROM evidence_winners ew
        UNION ALL
        SELECT
            gsw.destination_alias,
            gsw.node_fqdn,
            gsw.node_ciid
        FROM global_source_winners gsw
        WHERE NOT EXISTS (
            SELECT 1
            FROM evidence_winners ew
            WHERE ew.destination_alias = gsw.destination_alias
        )
        UNION ALL
        SELECT
            mw.destination_alias,
            mw.node_fqdn,
            mw.node_ciid
        FROM map_winners mw
        WHERE NOT EXISTS (
            SELECT 1
            FROM evidence_winners ew
            WHERE ew.destination_alias = mw.destination_alias
        )
          AND NOT EXISTS (
            SELECT 1
            FROM global_source_winners gsw
            WHERE gsw.destination_alias = mw.destination_alias
        )
        UNION ALL
        SELECT
            fw.destination_alias,
            fw.node_fqdn,
            fw.node_ciid
        FROM fallback_winners fw
        WHERE NOT EXISTS (
            SELECT 1
            FROM evidence_winners ew
            WHERE ew.destination_alias = fw.destination_alias
        )
          AND NOT EXISTS (
            SELECT 1
            FROM global_source_winners gsw
            WHERE gsw.destination_alias = fw.destination_alias
        )
          AND NOT EXISTS (
            SELECT 1
            FROM map_winners mw
            WHERE mw.destination_alias = fw.destination_alias
        )
    )
    UPDATE ce
    SET
        ce.endpoint_b_fqdn = w.node_fqdn,
        ce.endpoint_b_ciid = w.node_ciid
    FROM dbo.connection_edge ce
    INNER JOIN winners w
        ON w.destination_alias = LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn)))
    WHERE NULLIF(LTRIM(RTRIM(ce.endpoint_b_fqdn)), '') IS NOT NULL
      AND ce.endpoint_b_fqdn NOT LIKE '%.%'
      AND (
            LOWER(LTRIM(RTRIM(ce.endpoint_b_fqdn))) <> w.node_fqdn
         OR ISNULL(ce.endpoint_b_ciid, '') <> ISNULL(w.node_ciid, '')
      );

    SET @updated_rows = @@ROWCOUNT;

    SELECT updated_rows = @updated_rows;
END;
GO
