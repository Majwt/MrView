USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.ports_override;
GO

CREATE TABLE dbo.ports_override (
    port_number int NOT NULL,
    protocol nvarchar(10) NOT NULL,
    service_name nvarchar(100) NOT NULL,
    description nvarchar(255) NULL,
    updated_at datetime2(0) NOT NULL CONSTRAINT DF_ports_override_updated_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_ports_override PRIMARY KEY (port_number, protocol),
    CONSTRAINT CK_ports_override_port_number CHECK (port_number BETWEEN 0 AND 65535),
    CONSTRAINT CK_ports_override_protocol CHECK (protocol IN ('tcp', 'udp', 'sctp', 'dccp', 'any'))
);
GO

MERGE dbo.ports_override AS target
USING (VALUES
    (0, 'any', 'Dynamic', NULL),
    (21, 'tcp', 'FTP', NULL),
    (22, 'tcp', 'SSH', NULL),
    (23, 'tcp', 'Telnet', NULL),
    (25, 'tcp', 'SMTP', NULL),
    (53, 'tcp', 'DNS', NULL),
    (53, 'udp', 'DNS', NULL),
    (80, 'tcp', 'HTTP', NULL),
    (110, 'tcp', 'POP3', NULL),
    (135, 'tcp', 'RPC', NULL),
    (143, 'tcp', 'IMAP', NULL),
    (389, 'tcp', 'LDAP', NULL),
    (443, 'tcp', 'HTTPS', NULL),
    (445, 'tcp', 'SMB', NULL),
    (465, 'tcp', 'SMTPS', NULL),
    (587, 'tcp', 'SMTP-Submission', NULL),
    (636, 'tcp', 'LDAPS', NULL),
    (993, 'tcp', 'IMAPS', NULL),
    (995, 'tcp', 'POP3S', NULL),
    (1433, 'tcp', 'MS-SQL', NULL),
    (1434, 'tcp', 'MS-SQL-Browser', NULL),
    (1444, 'tcp', 'MS-SQL', NULL),
    (1455, 'tcp', 'MS-SQL', NULL),
    (1466, 'tcp', 'MS-SQL', NULL),
    (1477, 'tcp', 'MS-SQL', NULL),
    (1488, 'tcp', 'MS-SQL', NULL),
    (1984, 'tcp', 'MrBig Agent', NULL),
    (3260, 'tcp', 'iSCSI-Target', NULL),
    (3306, 'tcp', 'MySQL', NULL),
    (3389, 'tcp', 'RDP', NULL),
    (5022, 'tcp', 'MS-SQL-Listener', NULL),
    (5023, 'tcp', 'MS-SQL-Listener', NULL),
    (5024, 'tcp', 'MS-SQL-Listener', NULL),
    (5025, 'tcp', 'MS-SQL-Listener', NULL),
    (5432, 'tcp', 'PostgreSQL', NULL),
    (5985, 'tcp', 'WinRM-HTTP', NULL),
    (5986, 'tcp', 'WinRM-HTTPS', NULL),
    (8080, 'tcp', 'HTTP-Alt', NULL),
    (8181, 'tcp', 'AxiAnswer', NULL),
    (8403, 'tcp', 'Commvault', NULL),
    (8443, 'tcp', 'HTTPS-Alt', NULL),
    (9000, 'tcp', 'SQL Proxy via LK', NULL),
    (12202, 'tcp', 'Graylog', NULL),
    (24158, 'tcp', 'WMI', NULL)
) AS source(port_number, protocol, service_name, description)
ON target.port_number = source.port_number
   AND target.protocol = source.protocol
WHEN MATCHED THEN
    UPDATE SET
        service_name = source.service_name,
        description = source.description,
        updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (port_number, protocol, service_name, description)
    VALUES (source.port_number, source.protocol, source.service_name, source.description);
GO
