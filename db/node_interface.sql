USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.node_interface;
GO

CREATE TABLE dbo.node_interface (
    server_id nvarchar(128) NOT NULL,
    mac_address char(17) NOT NULL,
    fqdn nvarchar(255) NOT NULL,
    address_ipv4 varchar(45) NOT NULL,
    first_seen datetime2(0) NOT NULL,
    last_seen datetime2(0) NOT NULL,

    CONSTRAINT PK_node_interface PRIMARY KEY (server_id, mac_address),
    CONSTRAINT FK_node_interface_managed_node
        FOREIGN KEY (server_id) REFERENCES dbo.managed_node(server_id)
);
GO

CREATE INDEX IX_node_interface_mac
ON dbo.node_interface (mac_address);
GO

CREATE INDEX IX_node_interface_ip
ON dbo.node_interface (address_ipv4);
GO
