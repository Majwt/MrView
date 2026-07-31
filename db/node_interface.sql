USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.node_interface;
GO

CREATE TABLE dbo.node_interface (
    ciid nvarchar(128) NOT NULL,
    mac_address nvarchar(64) NOT NULL,
    fqdn nvarchar(255) NOT NULL,
    adapter nvarchar(255) NULL,
    address_ipv4 nvarchar(45) NULL,
    netmask_ipv4 nvarchar(45) NULL,
    address_ipv6 nvarchar(45) NULL,
    netmask_ipv6 nvarchar(45) NULL,
    description nvarchar(255) NULL,
    last_status nvarchar(64) NULL,
    first_seen datetime2(0) NOT NULL,
    last_seen datetime2(0) NOT NULL,
    is_active bit NOT NULL CONSTRAINT DF_node_interface_is_active DEFAULT (1),

    CONSTRAINT PK_node_interface PRIMARY KEY (ciid, mac_address),
    CONSTRAINT FK_node_interface_managed_node
        FOREIGN KEY (ciid) REFERENCES dbo.managed_node(ciid)
);
GO

CREATE INDEX IX_node_interface_server
ON dbo.node_interface (ciid);
GO

CREATE INDEX IX_node_interface_mac
ON dbo.node_interface (mac_address);
GO

CREATE INDEX IX_node_interface_ip_v4
ON dbo.node_interface (address_ipv4);
GO

CREATE INDEX IX_node_interface_ip_v6
ON dbo.node_interface (address_ipv6);
GO

CREATE INDEX IX_node_interface_status
ON dbo.node_interface (last_status);
GO
