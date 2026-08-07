USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.node_interface_raw;
GO

CREATE TABLE dbo.node_interface_raw (
    id bigint IDENTITY(1,1) NOT NULL,

    ciid nvarchar(128) NOT NULL,
    mac_address nvarchar(64) NOT NULL,
    fqdn nvarchar(255) NOT NULL,
    adapter nvarchar(255) NULL,
    address_ipv4 nvarchar(45) NULL,
    netmask_ipv4 nvarchar(45) NULL,
    address_ipv6 nvarchar(45) NULL,
    netmask_ipv6 nvarchar(45) NULL,
    description nvarchar(255) NULL,
    state nvarchar(64) NULL,
    DateAdded datetime2(0) NOT NULL,

    CONSTRAINT PK_node_interface_raw PRIMARY KEY (id),

    CONSTRAINT CK_node_interface_raw_has_ip
        CHECK (
            (address_ipv4 IS NOT NULL AND address_ipv4 <> '')
            OR (address_ipv6 IS NOT NULL AND address_ipv6 <> '')
        )
);
GO

CREATE INDEX IX_node_interface_raw_server_observed
ON dbo.node_interface_raw (ciid, DateAdded DESC, id DESC);
GO

CREATE INDEX IX_node_interface_raw_mac
ON dbo.node_interface_raw (mac_address);
GO

CREATE INDEX IX_node_interface_raw_ip_v4
ON dbo.node_interface_raw (address_ipv4);
GO

CREATE INDEX IX_node_interface_raw_ip_v6
ON dbo.node_interface_raw (address_ipv6);
GO
