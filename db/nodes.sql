USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.nodes;
GO

CREATE TABLE dbo.nodes (
    Id bigint IDENTITY(1,1) NOT NULL,

    CmdbCiId nvarchar(128) NULL,
    Customer nvarchar(100) NULL,
    CustomerID int NULL,

    Fqdn nvarchar(255) NOT NULL,
    AdapterName nvarchar(128) NULL,

    AddressIPv4 nvarchar(45) NOT NULL,
    Subnet nvarchar(45) NULL,
    MacAddress nvarchar(45) NULL,

    EphemeralPortStart int NULL,
    EphemeralPortEnd int NULL,

    DateAdded datetime2(0) NOT NULL
        CONSTRAINT DF_nodes_DateAdded
        DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_nodes PRIMARY KEY (Id),

    CONSTRAINT CK_nodes_ephemeral_range
        CHECK (
            EphemeralPortStart IS NULL
            OR EphemeralPortEnd IS NULL
            OR EphemeralPortStart <= EphemeralPortEnd
        )
);
GO

CREATE INDEX IX_nodes_fqdn
ON dbo.nodes (Fqdn);
GO

CREATE INDEX IX_nodes_address_ipv4
ON dbo.nodes (AddressIPv4);
GO

CREATE INDEX IX_nodes_date_added
ON dbo.nodes (DateAdded);
GO