USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.ports;
GO

CREATE TABLE dbo.ports (
    port_number int NOT NULL,
    protocol nvarchar(10) NOT NULL,
    service_name nvarchar(100) NOT NULL,
    description nvarchar(255) NULL,

    CONSTRAINT PK_ports PRIMARY KEY (port_number, protocol),
    CONSTRAINT CK_ports_port_number CHECK (port_number BETWEEN 0 AND 65535),
    CONSTRAINT CK_ports_protocol CHECK (protocol IN ('tcp', 'udp', 'sctp', 'dccp', 'any'))
);
GO

CREATE INDEX IX_ports_service_name
ON dbo.ports (service_name);
GO
