USE AxiNetStat;
GO

DROP TABLE IF EXISTS test.top_connections;
GO

CREATE TABLE test.top_connections (
    id bigint IDENTITY(1,1) NOT NULL,

    endpoint_a nvarchar(255) NOT NULL,
    endpoint_b nvarchar(255) NOT NULL,

    protocol nvarchar(4) NOT NULL,

    service_fqdn nvarchar(255) NULL,
    service_port int NULL,
    service_name nvarchar(100) NULL,

    known_process_name nvarchar(255) NULL,

    seen_count bigint NOT NULL
        CONSTRAINT DF_top_connections_seen_count DEFAULT 0,

    source_fqdn nvarchar(255) NOT NULL,
    source_ip varchar(45) NOT NULL,
    source_port int NULL,
    source_pid int NULL,
    source_process_name nvarchar(255) NULL,

    target_fqdn nvarchar(255) NOT NULL,
    target_ip varchar(45) NOT NULL,
    target_port int NULL,
    target_pid int NULL,
    target_process_name nvarchar(255) NULL,

    first_seen datetime2 NULL,
    last_seen datetime2 NULL,

    edge_key AS
        CONVERT(varchar(64), HASHBYTES(
            'SHA2_256',
            CONCAT(
                LOWER(endpoint_a), '|',
                LOWER(endpoint_b), '|',
                UPPER(protocol), '|',
                LOWER(ISNULL(service_fqdn, '')), '|',
                ISNULL(CONVERT(varchar(20), service_port), ''), '|',
                LOWER(ISNULL(known_process_name, 'unknown'))
            )
        ), 2) PERSISTED,

    CONSTRAINT PK_top_connections PRIMARY KEY (id),

    CONSTRAINT CK_top_connections_protocol
        CHECK (protocol IN ('TCP', 'UDP'))
);
GO

CREATE UNIQUE INDEX UX_top_connections_edge_key
ON test.top_connections (edge_key);
GO

CREATE INDEX IX_top_connections_dates
ON test.top_connections (last_seen, first_seen);
GO

CREATE INDEX IX_top_connections_lookup
ON test.top_connections (
    endpoint_a,
    endpoint_b,
    protocol,
    service_port
);
GO

CREATE INDEX IX_top_connections_seen
ON test.top_connections (
    seen_count DESC,
    last_seen DESC
);
GO

CREATE INDEX IX_top_connections_service
ON test.top_connections (
    service_name,
    service_port
);
GO
