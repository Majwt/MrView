USE AXINETSTAT;
CREATE TABLE dbo.known_ports (
    protocol nvarchar(4) NOT NULL,
    port int NOT NULL,
    service_name nvarchar(100) NOT NULL,

    CONSTRAINT PK_known_ports PRIMARY KEY (protocol, port),
    CONSTRAINT CK_known_ports_protocol CHECK (protocol IN ('TCP', 'UDP'))
);

MERGE dbo.known_ports AS target
USING (VALUES
            ('TCP', 0, 'Dynamic'),
            ('UDP', 0, 'Dynamic'),

            ('TCP', 21, 'FTP'),
            ('TCP', 22, 'SSH'),
            ('TCP', 23, 'Telnet'),
            ('TCP', 25, 'SMTP'),

            ('TCP', 53, 'DNS'),
            ('UDP', 53, 'DNS'),

            ('TCP', 80, 'HTTP'),
            ('UDP', 80, 'HTTP/3-Alt'),

            ('TCP', 110, 'POP3'),

            ('TCP', 135, 'RPC'),
            ('UDP', 135, 'RPC'),

            ('TCP', 143, 'IMAP'),

            ('TCP', 389, 'LDAP'),
            ('UDP', 389, 'LDAP'),

            ('TCP', 443, 'HTTPS'),
            ('UDP', 443, 'QUIC/HTTP3'),

            ('TCP', 445, 'SMB'),
            ('UDP', 445, 'SMB'),

            ('TCP', 465, 'SMTPS'),
            ('TCP', 587, 'SMTP-Submission'),

            ('TCP', 636, 'LDAPS'),
            ('UDP', 636, 'LDAPS'),

            ('TCP', 993, 'IMAPS'),
            ('TCP', 995, 'POP3S'),

            ('TCP', 1433, 'MS-SQL'),
            ('UDP', 1434, 'MS-SQL-Browser'),

            ('TCP', 1444, 'MS-SQL'),
            ('TCP', 1455, 'MS-SQL'),
            ('TCP', 1466, 'MS-SQL'),
            ('TCP', 1477, 'MS-SQL'),
            ('TCP', 1488, 'MS-SQL'),

            ('TCP', 1984, 'MrBig Agent'),

            ('TCP', 3260, 'iSCSI-Target'),

            ('TCP', 3306, 'MySQL'),

            ('TCP', 3389, 'RDP'),
            ('UDP', 3389, 'RDP'),

            ('TCP', 5022, 'MS-SQL-Listener'),
            ('TCP', 5023, 'MS-SQL-Listener'),
            ('TCP', 5024, 'MS-SQL-Listener'),
            ('TCP', 5025, 'MS-SQL-Listener'),

            ('TCP', 5432, 'PostgreSQL'),

            ('TCP', 5985, 'WinRM-HTTP'),
            ('TCP', 5986, 'WinRM-HTTPS'),

            ('TCP', 8080, 'HTTP-Alt'),
            ('UDP', 8080, 'HTTP-Alt'),

            ('TCP', 8181, 'AxiAnswer'),

            ('TCP', 8403, 'Commvault'),

            ('TCP', 8443, 'HTTPS-Alt'),
            ('UDP', 8443, 'HTTPS-Alt'),

            ('TCP', 9000, 'SQL Proxy via LK'),

            ('TCP', 12202, 'Graylog'),
            ('UDP', 12202, 'Graylog'),

            ('TCP', 24158, 'WMI')
) AS source(protocol, port, service_name)
ON target.protocol = source.protocol
AND target.port = source.port
WHEN MATCHED THEN
    UPDATE SET service_name = source.service_name
WHEN NOT MATCHED THEN
    INSERT (protocol, port, service_name)
    VALUES (source.protocol, source.port, source.service_name);

