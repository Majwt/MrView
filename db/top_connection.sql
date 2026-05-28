-- [test].top_connections definition

-- Drop table

-- DROP TABLE [test].top_connections;
CREATE TABLE axinetstat.[test].top_connections (
	id bigint IDENTITY(1,1) NOT NULL,
	endpoint_a nvarchar(255)   NOT NULL,
	endpoint_b nvarchar(255)   NOT NULL,
	protocol nvarchar(4)   NOT NULL,
	service_port int NULL,
	service_name nvarchar(100)   NULL,
	seen_count bigint DEFAULT 0 NOT NULL,
	source_fqdn nvarchar(255)   NOT NULL,
	source_ip varchar(45)   NOT NULL,
	source_port int NULL,
	source_pid int NULL,
	source_process_name nvarchar(255)   NULL,
	target_fqdn nvarchar(255)   NOT NULL,
	target_ip varchar(45)   NOT NULL,
	target_port int NULL,
	target_pid int NULL,
	target_process_name nvarchar(255)   NULL,
	first_seen datetime2 NULL,
	last_seen datetime2 NULL,
	CONSTRAINT PK_top_connections PRIMARY KEY (id)
);

CREATE INDEX IX_top_connections_dates
ON axinatstat.[test].top_connections (last_seen, first_seen);

CREATE INDEX IX_top_connections_lookup
ON axinetstat.[test].top_connections (endpoint_a, endpoint_b, service_port);

CREATE INDEX IX_top_connections_seen
ON axinetstat.[test].top_connections (seen_count DESC, last_seen DESC);

CREATE INDEX IX_top_connections_service
ON axinetstat.[test].top_connections (service_name, service_port);

ALTER TABLE axinetstat.[test].top_connections
ADD CONSTRAINT CK_top_connections_protocol
CHECK (protocol IN ('TCP', 'UDP'));
