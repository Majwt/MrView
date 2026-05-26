
CREATE OR ALTER PROCEDURE [dbo].[refresh_top_connections]
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    
    DELETE FROM [dbo].[top_connections];

    ;WITH known_ports AS (
        SELECT *
        FROM (VALUES
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
        ) AS p(protocol, port, service_name)
    ),
    normalized_base AS (
        SELECT
            c.Id AS id,
            c.HostName AS host_name,
            UPPER(c.Protocol) AS protocol,
            c.Direction AS direction,
            c.ProcessID AS pid,
            c.ProcessName AS process_name,
            c.LocalFqdn AS source_fqdn,
            c.LocalAddressIPv4 AS source_ip,
            c.LocalPort AS source_port,
            c.RemoteFqdn AS target_fqdn,
            c.RemoteAddressIPv4 AS target_ip,
            c.RemotePort AS target_port,
            c.DateAdded AS date_added,

            CASE
                WHEN sp.port IS NOT NULL AND tp.port IS NULL THEN c.LocalPort
                WHEN tp.port IS NOT NULL AND sp.port IS NULL THEN c.RemotePort

                WHEN c.Direction = 'Outgoing' THEN c.RemotePort
                WHEN c.Direction = 'Incoming' THEN c.LocalPort

                WHEN c.LocalPort BETWEEN 49152 AND 65535
                 AND c.RemotePort NOT BETWEEN 49152 AND 65535 THEN c.RemotePort

                WHEN c.RemotePort BETWEEN 49152 AND 65535
                 AND c.LocalPort NOT BETWEEN 49152 AND 65535 THEN c.LocalPort

                ELSE IIF(c.LocalPort <= c.RemotePort, c.LocalPort, c.RemotePort)
            END AS service_port
        FROM [dbo].[connections] AS c
        LEFT JOIN known_ports AS sp
            ON UPPER(c.Protocol) = sp.protocol
           AND c.LocalPort = sp.port
        LEFT JOIN known_ports AS tp
            ON UPPER(c.Protocol) = tp.protocol
           AND c.RemotePort = tp.port
    ),
    normalized AS (
        SELECT
            nb.*,

            nb.source_fqdn AS endpoint_a,
            nb.target_fqdn AS endpoint_b,

            CASE
                WHEN nb.service_port = nb.source_port THEN nb.source_fqdn
                WHEN nb.service_port = nb.target_port THEN nb.target_fqdn
                ELSE nb.target_fqdn
            END AS service_fqdn,

            COALESCE(
                kp.service_name,
                CASE
                    WHEN nb.service_port BETWEEN 49152 AND 65535 THEN 'Dynamic'
                    ELSE 'Unknown'
                END
            ) AS service_name,

            CASE
                WHEN LOWER(nb.host_name) = LOWER(nb.source_fqdn)
                  OR LOWER(nb.host_name) = LOWER(LEFT(nb.source_fqdn, CHARINDEX('.', nb.source_fqdn + '.') - 1))
                THEN nb.pid
            END AS normalized_source_pid,

            CASE
                WHEN LOWER(nb.host_name) = LOWER(nb.source_fqdn)
                  OR LOWER(nb.host_name) = LOWER(LEFT(nb.source_fqdn, CHARINDEX('.', nb.source_fqdn + '.') - 1))
                THEN nb.process_name
            END AS normalized_source_process_name,

            CASE
                WHEN LOWER(nb.host_name) = LOWER(nb.target_fqdn)
                  OR LOWER(nb.host_name) = LOWER(LEFT(nb.target_fqdn, CHARINDEX('.', nb.target_fqdn + '.') - 1))
                THEN nb.pid
            END AS normalized_target_pid,

            CASE
                WHEN LOWER(nb.host_name) = LOWER(nb.target_fqdn)
                  OR LOWER(nb.host_name) = LOWER(LEFT(nb.target_fqdn, CHARINDEX('.', nb.target_fqdn + '.') - 1))
                THEN nb.process_name
            END AS normalized_target_process_name
        FROM normalized_base AS nb
        LEFT JOIN known_ports AS kp
            ON nb.protocol = kp.protocol
           AND nb.service_port = kp.port
    ),
    grouped AS (
        SELECT
            endpoint_a,
            endpoint_b,
            protocol,
            service_fqdn,
            service_port,

            MAX(service_name) AS service_name,
            COUNT_BIG(*) AS seen_count,

            MAX(normalized_source_pid) AS source_pid,
            MAX(normalized_source_process_name) AS source_process_name,
            MAX(normalized_target_pid) AS target_pid,
            MAX(normalized_target_process_name) AS target_process_name,

            MIN(date_added) AS first_seen,
            MAX(date_added) AS last_seen
        FROM normalized
        GROUP BY
            endpoint_a,
            endpoint_b,
            protocol,
            service_fqdn,
            service_port
    ),
    latest_row AS (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY
                    endpoint_a,
                    endpoint_b,
                    protocol,
                    service_fqdn,
                    service_port
                ORDER BY
                    date_added DESC,
                    id DESC
            ) AS rn
        FROM normalized
    )
    MERGE [dbo].[top_connections] AS t
    USING (
        SELECT
            lr.endpoint_a,
            lr.endpoint_b,
            lr.protocol,
            lr.service_fqdn,
            lr.service_port,
            g.service_name,
            g.seen_count,

            lr.host_name,
            lr.pid,
            lr.process_name,

            lr.source_fqdn,
            lr.source_ip,
            lr.source_port,
            g.source_pid,
            g.source_process_name,

            lr.target_fqdn,
            lr.target_ip,
            lr.target_port,
            g.target_pid,
            g.target_process_name,

            lr.date_added,
            g.first_seen,
            g.last_seen
        FROM latest_row AS lr
        INNER JOIN grouped AS g
            ON lr.endpoint_a = g.endpoint_a
           AND lr.endpoint_b = g.endpoint_b
           AND lr.protocol = g.protocol
           AND ISNULL(lr.service_fqdn, '') = ISNULL(g.service_fqdn, '')
           AND ISNULL(lr.service_port, -1) = ISNULL(g.service_port, -1)
        WHERE lr.rn = 1
    ) AS s
    ON  t.endpoint_a = s.endpoint_a
    AND t.endpoint_b = s.endpoint_b
    AND t.protocol = s.protocol
    AND ISNULL(t.service_fqdn, '') = ISNULL(s.service_fqdn, '')
    AND ISNULL(t.service_port, -1) = ISNULL(s.service_port, -1)

    WHEN MATCHED THEN
        UPDATE SET
            t.service_name = s.service_name,
            t.seen_count = s.seen_count,

            t.host_name = s.host_name,
            t.pid = s.pid,
            t.process_name = s.process_name,

            t.source_fqdn = s.source_fqdn,
            t.source_ip = s.source_ip,
            t.source_port = s.source_port,
            t.source_pid = s.source_pid,
            t.source_process_name = s.source_process_name,

            t.target_fqdn = s.target_fqdn,
            t.target_ip = s.target_ip,
            t.target_port = s.target_port,
            t.target_pid = s.target_pid,
            t.target_process_name = s.target_process_name,

            t.date_added = s.date_added,
            t.first_seen = s.first_seen,
            t.last_seen = s.last_seen

    WHEN NOT MATCHED THEN
        INSERT (
            endpoint_a,
            endpoint_b,
            protocol,
            service_fqdn,
            service_port,
            service_name,
            seen_count,

            host_name,
            pid,
            process_name,

            source_fqdn,
            source_ip,
            source_port,
            source_pid,
            source_process_name,

            target_fqdn,
            target_ip,
            target_port,
            target_pid,
            target_process_name,

            date_added,
            first_seen,
            last_seen
        )
        VALUES (
            s.endpoint_a,
            s.endpoint_b,
            s.protocol,
            s.service_fqdn,
            s.service_port,
            s.service_name,
            s.seen_count,

            s.host_name,
            s.pid,
            s.process_name,

            s.source_fqdn,
            s.source_ip,
            s.source_port,
            s.source_pid,
            s.source_process_name,

            s.target_fqdn,
            s.target_ip,
            s.target_port,
            s.target_pid,
            s.target_process_name,

            s.date_added,
            s.first_seen,
            s.last_seen
        );

    COMMIT TRANSACTION;
END;


