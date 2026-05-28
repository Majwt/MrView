CREATE OR ALTER PROCEDURE test.refresh_top_connections
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DELETE FROM test.top_connections;

    ;WITH normalized_base AS (
        SELECT
            c.Id AS id,
            c.HostName AS host_name,
            UPPER(c.Protocol) AS protocol,
            c.Direction AS direction,
            c.ProcessID AS pid,
            c.ProcessName AS process_name,

            COALESCE(c.LocalFqdn, c.LocalAddressIPv4) AS source_fqdn,
            c.LocalAddressIPv4 AS source_ip,
            c.LocalPort AS source_port,

            COALESCE(c.RemoteFqdn, c.RemoteAddressIPv4) AS target_fqdn,
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
        FROM test.connections AS c
        LEFT JOIN test.known_ports AS sp
            ON UPPER(c.Protocol) = sp.protocol
           AND c.LocalPort = sp.port
        LEFT JOIN test.known_ports AS tp
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
        LEFT JOIN test.known_ports AS kp
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
                ORDER BY date_added DESC, id DESC
            ) AS rn
        FROM normalized
    )
    INSERT INTO test.top_connections (
        endpoint_a,
        endpoint_b,
        protocol,
        service_port,
        service_name,
        seen_count,

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

        first_seen,
        last_seen
    )
    SELECT
        lr.endpoint_a,
        lr.endpoint_b,
        lr.protocol,
        lr.service_port,
        g.service_name,
        g.seen_count,

        lr.source_fqdn,
        lr.source_ip,
        lr.source_port,
        lr.normalized_source_pid,
        lr.normalized_source_process_name,

        lr.target_fqdn,
        lr.target_ip,
        lr.target_port,
        lr.normalized_target_pid,
        lr.normalized_target_process_name,

        g.first_seen,
        g.last_seen
    FROM latest_row AS lr
    INNER JOIN grouped AS g
        ON lr.endpoint_a = g.endpoint_a
       AND lr.endpoint_b = g.endpoint_b
       AND lr.protocol = g.protocol
       AND ISNULL(lr.service_fqdn, '') = ISNULL(g.service_fqdn, '')
       AND ISNULL(lr.service_port, -1) = ISNULL(g.service_port, -1)
    WHERE lr.rn = 1;

    COMMIT TRANSACTION;
END;
