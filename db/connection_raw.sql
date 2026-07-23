USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.connection_raw;
GO

CREATE TABLE dbo.connection_raw (
    id bigint IDENTITY(1,1) NOT NULL,

    observed_at datetime2(0) NOT NULL,
    reporter_server_id nvarchar(128) NOT NULL,

    direction varchar(10) NULL,
    protocol varchar(10) NOT NULL CONSTRAINT DF_connection_raw_protocol DEFAULT ('tcp'),
    state varchar(30) NULL,

    local_fqdn nvarchar(255) NOT NULL,
    local_address_ipv4 varchar(45) NOT NULL,
    local_port int NULL,
    local_mac_address char(17) NULL,

    remote_fqdn nvarchar(255) NOT NULL,
    remote_address_ipv4 varchar(45) NOT NULL,
    remote_port int NULL,
    remote_mac_address char(17) NULL,

    process_name nvarchar(260) NULL,
    process_id int NULL,

    CONSTRAINT PK_connection_raw PRIMARY KEY (id),
    CONSTRAINT FK_connection_raw_managed_node
        FOREIGN KEY (reporter_server_id) REFERENCES dbo.managed_node(server_id),
    CONSTRAINT CK_connection_raw_local_port
        CHECK (local_port IS NULL OR (local_port BETWEEN 0 AND 65535)),
    CONSTRAINT CK_connection_raw_remote_port
        CHECK (remote_port IS NULL OR (remote_port BETWEEN 0 AND 65535))
);
GO

CREATE INDEX IX_connection_raw_observed_at
ON dbo.connection_raw (observed_at DESC, id DESC);
GO

CREATE INDEX IX_connection_raw_reporter
ON dbo.connection_raw (reporter_server_id, observed_at DESC, id DESC);
GO

CREATE INDEX IX_connection_raw_pair_lookup
ON dbo.connection_raw (
    protocol,
    local_address_ipv4,
    remote_address_ipv4,
    local_port,
    remote_port,
    observed_at DESC
);
GO
