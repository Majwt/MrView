USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.connections;
GO

CREATE TABLE dbo.connections (
    Id bigint IDENTITY(1,1) NOT NULL,

    HostName nvarchar(255) NOT NULL,

    ProcessName nvarchar(255) NULL,
    ProcessID int NULL,

    Direction nvarchar(20) NOT NULL,

    LocalFqdn nvarchar(255) NULL,
    LocalAddressIPv4 varchar(45) NOT NULL,
    LocalPort int NOT NULL,

    RemoteFqdn nvarchar(255) NULL,
    RemoteAddressIPv4 varchar(45) NOT NULL,
    RemotePort int NOT NULL,

    State nvarchar(50) NULL,

    DateAdded datetimeoffset(0) NOT NULL
        CONSTRAINT DF_connections_DateAdded
        DEFAULT TODATETIMEOFFSET(SYSUTCDATETIME(), '+00:00'),

    CONSTRAINT PK_connections PRIMARY KEY (Id),

    CONSTRAINT CK_connections_direction
        CHECK (Direction IN ('Unknown', 'Incoming', 'Outgoing'))
);
GO

CREATE INDEX IX_connections_date_added
ON dbo.connections (DateAdded, Id);
GO

CREATE INDEX IX_connections_local
ON dbo.connections (LocalFqdn, LocalAddressIPv4, LocalPort);
GO

CREATE INDEX IX_connections_remote
ON dbo.connections (RemoteFqdn, RemoteAddressIPv4, RemotePort);
GO

CREATE INDEX IX_connections_host
ON dbo.connections (HostName);
GO