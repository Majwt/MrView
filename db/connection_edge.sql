USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.connection_edge;
GO

CREATE TABLE dbo.connection_edge (
    id bigint IDENTITY(1,1) NOT NULL,

    endpoint_a_fqdn nvarchar(255) NOT NULL,
    endpoint_a_ipv4 varchar(45) NOT NULL,
    endpoint_a_mac_address char(17) NULL,
    endpoint_a_server_id nvarchar(128) NULL,
    endpoint_a_process_name nvarchar(260) NULL,
    endpoint_a_process_id int NULL,

    endpoint_b_fqdn nvarchar(255) NOT NULL,
    endpoint_b_ipv4 varchar(45) NOT NULL,
    endpoint_b_mac_address char(17) NULL,
    endpoint_b_server_id nvarchar(128) NULL,
    endpoint_b_process_name nvarchar(260) NULL,
    endpoint_b_process_id int NULL,

    protocol varchar(10) NOT NULL,
    service_port int NULL,

    seen_count bigint NOT NULL CONSTRAINT DF_connection_edge_seen_count DEFAULT (0),
    first_seen datetime2(0) NOT NULL,
    last_seen datetime2(0) NOT NULL,
    confidence tinyint NOT NULL CONSTRAINT DF_connection_edge_confidence DEFAULT (0),

    edge_key AS
        CONVERT(nvarchar(64), HASHBYTES(
            'SHA2_256',
            CONCAT(
                LOWER(ISNULL(endpoint_a_fqdn, '')), '|',
                ISNULL(endpoint_a_ipv4, ''), '|',
                LOWER(ISNULL(endpoint_a_mac_address, '')), '|',
                LOWER(ISNULL(endpoint_b_fqdn, '')), '|',
                ISNULL(endpoint_b_ipv4, ''), '|',
                LOWER(ISNULL(endpoint_b_mac_address, '')), '|',
                LOWER(ISNULL(protocol, '')), '|',
                ISNULL(CONVERT(nvarchar(20), service_port), '')
            )
        ), 2) PERSISTED,

    CONSTRAINT PK_connection_edge PRIMARY KEY (id),
    CONSTRAINT FK_connection_edge_a_managed_node
        FOREIGN KEY (endpoint_a_server_id) REFERENCES dbo.managed_node(server_id),
    CONSTRAINT FK_connection_edge_b_managed_node
        FOREIGN KEY (endpoint_b_server_id) REFERENCES dbo.managed_node(server_id),
    CONSTRAINT CK_connection_edge_service_port
        CHECK (service_port IS NULL OR (service_port BETWEEN 0 AND 65535))
);
GO

CREATE UNIQUE INDEX UX_connection_edge_edge_key
ON dbo.connection_edge (edge_key);
GO

CREATE INDEX IX_connection_edge_last_seen
ON dbo.connection_edge (last_seen DESC, id DESC);
GO

CREATE INDEX IX_connection_edge_endpoint_a
ON dbo.connection_edge (endpoint_a_ipv4, protocol, service_port);
GO

CREATE INDEX IX_connection_edge_endpoint_b
ON dbo.connection_edge (endpoint_b_ipv4, protocol, service_port);
GO
