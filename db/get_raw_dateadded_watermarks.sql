USE AxiNetStat;
GO

CREATE OR ALTER PROCEDURE dbo.get_raw_dateadded_watermarks
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @connection_raw_last_dateadded datetime2(0) = (
        SELECT MAX(DateAdded)
        FROM dbo.connection_raw
    );

    DECLARE @node_raw_last_dateadded datetime2(0) = (
        SELECT MAX(DateAdded)
        FROM dbo.node_raw
    );

    DECLARE @node_interface_raw_last_dateadded datetime2(0) = (
        SELECT MAX(DateAdded)
        FROM dbo.node_interface_raw
    );

    SELECT
        @connection_raw_last_dateadded AS connection_raw_last_dateadded,
        @node_raw_last_dateadded AS node_raw_last_dateadded,
        @node_interface_raw_last_dateadded AS node_interface_raw_last_dateadded,
        (
            SELECT MIN(v.ts)
            FROM (VALUES
                (@connection_raw_last_dateadded),
                (@node_raw_last_dateadded),
                (@node_interface_raw_last_dateadded)
            ) AS v(ts)
            WHERE v.ts IS NOT NULL
        ) AS earliest_allowed_fetch_start_utc;
END;
GO

GRANT EXECUTE ON OBJECT::dbo.get_raw_dateadded_watermarks TO db_datawriter;
GO

GRANT SELECT ON OBJECT::dbo.connection_raw TO db_datawriter;
GO

GRANT SELECT ON OBJECT::dbo.node_raw TO db_datawriter;
GO

GRANT SELECT ON OBJECT::dbo.node_interface_raw TO db_datawriter;
GO
