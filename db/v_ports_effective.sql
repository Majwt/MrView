USE AxiNetStat;
GO

CREATE OR ALTER VIEW dbo.v_ports_effective
AS
SELECT
    o.port_number,
    o.protocol,
    o.service_name,
    o.description,
    source_table = CAST('ports_override' AS nvarchar(20))
FROM dbo.ports_override o

UNION ALL

SELECT
    p.port_number,
    p.protocol,
    p.service_name,
    p.description,
    source_table = CAST('ports' AS nvarchar(20))
FROM dbo.ports p
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.ports_override o
    WHERE o.port_number = p.port_number
      AND o.protocol = p.protocol
);
GO
