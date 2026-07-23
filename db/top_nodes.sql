USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.top_nodes;
GO

CREATE TABLE dbo.top_nodes (
    Id bigint IDENTITY(1,1) NOT NULL,

    Fqdn nvarchar(255) NOT NULL,
    Hostname nvarchar(255) NOT NULL,

    InterfacesJson nvarchar(max) NULL,

    EphemeralPortStart int NULL,
    EphemeralPortEnd int NULL,

    CmdbCiId nvarchar(128) NULL,
    Customer nvarchar(100) NULL,
    CustomerID int NULL,

    EdgeCount bigint NOT NULL DEFAULT 0,
    ConnectionCount bigint NOT NULL DEFAULT 0,

    FirstSeen datetime2(0) NOT NULL,
    LastSeen datetime2(0) NOT NULL,

    CONSTRAINT PK_top_nodes PRIMARY KEY (Id),
    CONSTRAINT UQ_top_nodes_fqdn UNIQUE (Fqdn)
);
GO

CREATE INDEX IX_top_nodes_fqdn
ON dbo.top_nodes (Fqdn);
GO

CREATE INDEX IX_top_nodes_last_seen
ON dbo.top_nodes (LastSeen, Id);
GO