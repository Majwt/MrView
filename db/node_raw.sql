USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.node_raw;
GO

CREATE TABLE dbo.node_raw (
    id bigint IDENTITY(1,1) NOT NULL,

    ciid nvarchar(128) NOT NULL,

    group_id int NULL,
    group_name nvarchar(100) NULL,

    fqdn nvarchar(255) NOT NULL,
    os_version_family nvarchar(100) NULL,
    os_version_specifier nvarchar(255) NULL,

    ephemeral_port_start int NULL,
    ephemeral_port_end int NULL,
    DateAdded datetime2(0) NOT NULL,

    CONSTRAINT PK_node_raw PRIMARY KEY (id),
    CONSTRAINT FK_node_raw_managed_node
        FOREIGN KEY (ciid) REFERENCES dbo.managed_node(ciid),
    CONSTRAINT CK_node_raw_ephemeral_range
        CHECK (
            ephemeral_port_start IS NULL
            OR ephemeral_port_end IS NULL
            OR ephemeral_port_start <= ephemeral_port_end
        )
);
GO

CREATE INDEX IX_node_raw_date_added
ON dbo.node_raw (DateAdded DESC, id DESC);
GO

CREATE INDEX IX_node_raw_ciid
ON dbo.node_raw (ciid, DateAdded DESC, id DESC);
GO

CREATE INDEX IX_node_raw_fqdn
ON dbo.node_raw (fqdn);
GO
