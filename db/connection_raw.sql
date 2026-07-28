USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.connection_raw;
GO

CREATE TABLE dbo.connection_raw (
    id bigint IDENTITY(1,1) NOT NULL,

    reporter_ciid nvarchar(128) NOT NULL,

    direction nvarchar(10) NULL,
    protocol nvarchar(10) NOT NULL CONSTRAINT DF_connection_raw_protocol DEFAULT ('tcp'),
    state nvarchar(30) NULL,

    source_fqdn nvarchar(255) NOT NULL,
    source_address_ipv4 nvarchar(45) NOT NULL,
    source_port int NULL,

    target_fqdn nvarchar(255) NOT NULL,
    target_address_ipv4 nvarchar(45) NOT NULL,
    target_port int NULL,

    process_name nvarchar(260) NULL,
    process_id int NULL,
    DateAdded datetime2(0) NOT NULL,

    CONSTRAINT PK_connection_raw PRIMARY KEY (id),
    CONSTRAINT CK_connection_raw_source_port
        CHECK (source_port IS NULL OR (source_port BETWEEN 0 AND 65535)),
    CONSTRAINT CK_connection_raw_target_port
        CHECK (target_port IS NULL OR (target_port BETWEEN 0 AND 65535))
);
GO

CREATE INDEX IX_connection_raw_date_added
ON dbo.connection_raw (DateAdded DESC, id DESC);
GO

CREATE INDEX IX_connection_raw_reporter
ON dbo.connection_raw (reporter_ciid, DateAdded DESC, id DESC);
GO

CREATE INDEX IX_connection_raw_pair_lookup
ON dbo.connection_raw (
    protocol,
    source_address_ipv4,
    target_address_ipv4,
    source_port,
    target_port,
    DateAdded DESC
);
GO
