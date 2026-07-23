USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.top_connections;
GO

CREATE TABLE dbo.top_connections (
    Id bigint IDENTITY(1,1) NOT NULL,

    endpoint_a nvarchar(255) NOT NULL,
    endpoint_b nvarchar(255) NOT NULL,

    service_fqdn nvarchar(255) NULL,
    service_port int NULL,
    service_name nvarchar(100) NULL,

    seen_count bigint NOT NULL
        CONSTRAINT DF_top_connections_seen_count DEFAULT 0,

    source_fqdn nvarchar(255) NOT NULL,
    source_ip nvarchar(45) NOT NULL,
    source_port int NULL,
    source_pid int NULL,
    source_process_name nvarchar(255) NULL,

    target_fqdn nvarchar(255) NOT NULL,
    target_ip nvarchar(45) NOT NULL,
    target_port int NULL,
    target_pid int NULL,
    target_process_name nvarchar(255) NULL,

    first_seen datetime2(0) NULL,
    last_seen datetime2(0) NULL,

    edge_key AS
        CONVERT(nvarchar(64), HASHBYTES(
            'SHA2_256',
            CONCAT(
                LOWER(endpoint_a), '|',
                LOWER(endpoint_b), '|',
                LOWER(ISNULL(service_fqdn, '')), '|',
                ISNULL(CONVERT(nvarchar(20), service_port), '')
            )
        ), 2) PERSISTED,

    CONSTRAINT PK_top_connections PRIMARY KEY (Id)
);
GO

CREATE UNIQUE INDEX UX_top_connections_edge_key
ON dbo.top_connections (edge_key);
GO

CREATE INDEX IX_top_connections_dates
ON dbo.top_connections (last_seen, first_seen);
GO

CREATE INDEX IX_top_connections_lookup
ON dbo.top_connections (
    endpoint_a,
    endpoint_b,
    service_port
);
GO

CREATE INDEX IX_top_connections_seen
ON dbo.top_connections (
    seen_count DESC,
    last_seen DESC
);
GO

CREATE INDEX IX_top_connections_service
ON dbo.top_connections (
    service_name,
    service_port
);
GO