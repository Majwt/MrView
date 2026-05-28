

CREATE TABLE axinetstat.test.top_nodes (
    Id bigint IDENTITY(1,1) NOT NULL,
    Fqdn nvarchar(255) NOT NULL,
    Hostname nvarchar(255) NOT NULL,
    InterfacesJson nvarchar(max) NULL,
    CmdbCiId nvarchar(128) NULL,
    Customer nvarchar(100) NULL,
    CustomerID int NULL,
    UniqueEdges bigint NOT NULL DEFAULT 0,
    ConnectionCount bigint NOT NULL DEFAULT 0,
    FirstSeen datetime2 NOT NULL,
    LastSeen datetime2 NOT NULL,

    CONSTRAINT PK_top_nodes PRIMARY KEY (Id),
    CONSTRAINT UQ_top_nodes_fqdn UNIQUE (Fqdn)
);

CREATE INDEX IX_top_nodes_fqdn
ON axinetstat.test.top_nodes (Fqdn);

CREATE INDEX IX_top_nodes_last_seen
ON axinetstat.test.top_nodes (LastSeen, Id);
