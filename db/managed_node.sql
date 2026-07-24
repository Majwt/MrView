USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.managed_node;
GO

CREATE TABLE dbo.managed_node (
    ciid nvarchar(128) NOT NULL,
    fqdn nvarchar(255) NULL,
    os nvarchar(100) NULL,
    os_distribution nvarchar(255) NULL,
    os_version nvarchar(255) NULL,
    os_version_family nvarchar(100) NULL,
    os_version_distribution nvarchar(255) NULL,
    os_version_specifier nvarchar(255) NULL,
    group_id int NULL,
    group_name nvarchar(100) NULL,
    first_seen datetime2(0) NOT NULL,
    last_seen datetime2(0) NOT NULL,
    is_active bit NOT NULL CONSTRAINT DF_managed_node_is_active DEFAULT (1),

    CONSTRAINT PK_managed_node PRIMARY KEY (ciid)
);
GO

CREATE INDEX IX_managed_node_fqdn
ON dbo.managed_node (fqdn);
GO
