USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_managed_node
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH latest AS (
            SELECT
                nr.server_id,
                nr.fqdn,
                nr.os_version_family,
                nr.os_version_distribution,
                nr.os_version_specifier,
                nr.group_id,
                nr.group_name,
                nr.observed_at,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY nr.server_id
                    ORDER BY nr.observed_at DESC, nr.id DESC
                )
            FROM dbo.node_raw nr
        ),
        aggregate_range AS (
            SELECT
                nr.server_id,
                first_seen = MIN(nr.observed_at),
                last_seen = MAX(nr.observed_at)
            FROM dbo.node_raw nr
            GROUP BY nr.server_id
        ),
        source_rows AS (
            SELECT
                l.server_id,
                l.fqdn,
                l.os_version_family,
                l.os_version_distribution,
                l.os_version_specifier,
                l.group_id,
                l.group_name,
                a.first_seen,
                a.last_seen
            FROM latest l
            JOIN aggregate_range a
                ON a.server_id = l.server_id
            WHERE l.rn = 1
        )
        MERGE dbo.managed_node AS target
        USING source_rows AS source
        ON target.server_id = source.server_id

        WHEN MATCHED THEN
            UPDATE SET
                fqdn = source.fqdn,
                os_version_family = source.os_version_family,
                os_version_distribution = source.os_version_distribution,
                os_version_specifier = source.os_version_specifier,
                group_id = source.group_id,
                group_name = source.group_name,
                first_seen = CASE WHEN source.first_seen < target.first_seen THEN source.first_seen ELSE target.first_seen END,
                last_seen = CASE WHEN source.last_seen > target.last_seen THEN source.last_seen ELSE target.last_seen END,
                is_active = CASE
                    WHEN CASE WHEN source.last_seen > target.last_seen THEN source.last_seen ELSE target.last_seen END
                         >= DATEADD(day, -7, SYSUTCDATETIME())
                    THEN 1 ELSE 0
                END

        WHEN NOT MATCHED THEN
            INSERT (
                server_id,
                fqdn,
                os_version_family,
                os_version_distribution,
                os_version_specifier,
                group_id,
                group_name,
                first_seen,
                last_seen,
                is_active
            )
            VALUES (
                source.server_id,
                source.fqdn,
                source.os_version_family,
                source.os_version_distribution,
                source.os_version_specifier,
                source.group_id,
                source.group_name,
                source.first_seen,
                source.last_seen,
                CASE
                    WHEN source.last_seen >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1
                    ELSE 0
                END
            );

        UPDATE mn
        SET mn.is_active = CASE
            WHEN mn.last_seen >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1
            ELSE 0
        END
        FROM dbo.managed_node mn;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO
