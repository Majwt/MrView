USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.host_alias_map;
GO

CREATE TABLE dbo.host_alias_map (
    alias_name nvarchar(255) NOT NULL,
    canonical_fqdn nvarchar(255) NOT NULL,
    evidence_count bigint NOT NULL,
    confidence decimal(9,4) NOT NULL,
    updated_at datetime2(0) NOT NULL CONSTRAINT DF_host_alias_map_updated_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_host_alias_map PRIMARY KEY (alias_name)
);
GO

CREATE INDEX IX_host_alias_map_canonical
ON dbo.host_alias_map (canonical_fqdn);
GO
