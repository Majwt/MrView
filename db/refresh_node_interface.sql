USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.refresh_node_interface
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH latest AS (
            SELECT
                ni.ciid,
                ni.mac_address,
                ni.fqdn,
                ni.adapter,
                ni.address_ipv4,
                ni.netmask_ipv4,
                ni.address_ipv6,
                ni.netmask_ipv6,
                ni.description,
                ni.state,
                ni.DateAdded,
                rn = ROW_NUMBER() OVER (
                    PARTITION BY ni.ciid, ni.mac_address
                    ORDER BY ni.DateAdded DESC, ni.id DESC
                )
            FROM dbo.node_interface_raw ni
        ),
        aggregate_range AS (
            SELECT
                ni.ciid,
                ni.mac_address,
                first_seen = MIN(ni.DateAdded),
                last_seen = MAX(ni.DateAdded)
            FROM dbo.node_interface_raw ni
            GROUP BY ni.ciid, ni.mac_address
        ),
        source_rows AS (
            SELECT
                l.ciid,
                l.mac_address,
                l.fqdn,
                l.adapter,
                l.address_ipv4,
                l.netmask_ipv4,
                l.address_ipv6,
                l.netmask_ipv6,
                l.description,
                last_status = l.state,
                a.first_seen,
                a.last_seen
            FROM latest l
            INNER JOIN aggregate_range a
                ON a.ciid = l.ciid
               AND a.mac_address = l.mac_address
            WHERE l.rn = 1
        )
        MERGE dbo.node_interface AS target
        USING source_rows AS source
        ON target.ciid = source.ciid
           AND target.mac_address = source.mac_address

        WHEN MATCHED THEN
            UPDATE SET
                fqdn = source.fqdn,
                adapter = source.adapter,
                address_ipv4 = source.address_ipv4,
                netmask_ipv4 = source.netmask_ipv4,
                address_ipv6 = source.address_ipv6,
                netmask_ipv6 = source.netmask_ipv6,
                description = source.description,
                last_status = source.last_status,
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
                mac_address,
                fqdn,
                adapter,
                address_ipv4,
                netmask_ipv4,
                address_ipv6,
                netmask_ipv6,
                description,
                last_status,
                first_seen,
                last_seen,
                is_active
            )
            VALUES (
                source.ciid,
                source.mac_address,
                source.fqdn,
                source.adapter,
                source.address_ipv4,
                source.netmask_ipv4,
                source.address_ipv6,
                source.netmask_ipv6,
                source.description,
                source.last_status,
                source.first_seen,
                source.last_seen,
                CASE
                    WHEN source.last_seen >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1
                    ELSE 0
                END
            );

        UPDATE nia
        SET nia.is_active = CASE
            WHEN nia.last_seen >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1
            ELSE 0
        END
        FROM dbo.node_interface nia;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO
