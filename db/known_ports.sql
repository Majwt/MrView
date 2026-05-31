USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.known_ports;
GO

CREATE TABLE dbo.known_ports (
    port int NOT NULL,
    service_name nvarchar(100) NOT NULL,

    CONSTRAINT PK_known_ports PRIMARY KEY (port)
);
GO

MERGE dbo.known_ports AS target
USING (VALUES
    (0, 'Dynamic'),
    (21, 'FTP'),
    (22, 'SSH'),
    (23, 'Telnet'),
    (25, 'SMTP'),
    (53, 'DNS'),
    (80, 'HTTP'),
    (110, 'POP3'),
    (135, 'RPC'),
    (143, 'IMAP'),
    (389, 'LDAP'),
    (443, 'HTTPS'),
    (445, 'SMB'),
    (465, 'SMTPS'),
    (587, 'SMTP-Submission'),
    (636, 'LDAPS'),
    (993, 'IMAPS'),
    (995, 'POP3S'),
    (1433, 'MS-SQL'),
    (1434, 'MS-SQL-Browser'),
    (1444, 'MS-SQL'),
    (1455, 'MS-SQL'),
    (1466, 'MS-SQL'),
    (1477, 'MS-SQL'),
    (1488, 'MS-SQL'),
    (1984, 'MrBig Agent'),
    (3260, 'iSCSI-Target'),
    (3306, 'MySQL'),
    (3389, 'RDP'),
    (5022, 'MS-SQL-Listener'),
    (5023, 'MS-SQL-Listener'),
    (5024, 'MS-SQL-Listener'),
    (5025, 'MS-SQL-Listener'),
    (5432, 'PostgreSQL'),
    (5985, 'WinRM-HTTP'),
    (5986, 'WinRM-HTTPS'),
    (8080, 'HTTP-Alt'),
    (8181, 'AxiAnswer'),
    (8403, 'Commvault'),
    (8443, 'HTTPS-Alt'),
    (9000, 'SQL Proxy via LK'),
    (12202, 'Graylog'),
    (24158, 'WMI')
) AS source(port, service_name)
ON target.port = source.port
WHEN MATCHED THEN
    UPDATE SET service_name = source.service_name
WHEN NOT MATCHED THEN
    INSERT (port, service_name)
    VALUES (source.port, source.service_name);
GO