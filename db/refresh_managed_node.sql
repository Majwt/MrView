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
                nr.ciid,
                nr.fqdn,
                nr.os_version_family,
                nr.os_version_specifier,
                nr.client_name,
                nr.client_version,
                nr.group_id,
                nr.group_name,
                nr.DateAdded,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY nr.ciid
                    ORDER BY nr.DateAdded DESC, nr.id DESC
                )
            FROM dbo.node_raw nr
        ),
        aggregate_range AS (
            SELECT
                nr.ciid,
                first_seen = MIN(nr.DateAdded),
                last_seen = MAX(nr.DateAdded)
            FROM dbo.node_raw nr
            GROUP BY nr.ciid
        ),
        source_rows AS (
            SELECT
                l.ciid,
                l.fqdn,
                os = l.os_version_family,
                os_version = l.os_version_specifier,
                os_version_family = l.os_version_family,
                os_version_specifier = l.os_version_specifier,
                l.client_name,
                l.client_version,
                l.group_id,
                l.group_name,
                a.first_seen,
                a.last_seen
            FROM latest l
            JOIN aggregate_range a
                ON a.ciid = l.ciid
            WHERE l.rn = 1
        )
        MERGE dbo.managed_node AS target
        USING source_rows AS source
        ON target.ciid = source.ciid

        WHEN MATCHED THEN
            UPDATE SET
                fqdn = source.fqdn,
                os = source.os,
                os_version = source.os_version,
                os_version_family = source.os_version_family,
                os_version_specifier = source.os_version_specifier,
                client_name = source.client_name,
                client_version = source.client_version,
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
                ciid,
                fqdn,
                os,
                os_version,
                os_version_family,
                os_version_specifier,
                client_name,
                client_version,
                group_id,
                group_name,
                first_seen,
                last_seen,
                is_active
            )
            VALUES (
                source.ciid,
                source.fqdn,
                source.os,
                source.os_version,
                source.os_version_family,
                source.os_version_specifier,
                source.client_name,
                source.client_version,
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
