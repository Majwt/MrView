-- test.top_connections definition

-- Drop table

-- DROP TABLE test.top_connections;
CREATE TABLE test.top_connections (
	id bigint IDENTITY(1,1) NOT NULL,
	endpoint_a nvarchar(255)   NOT NULL,
	endpoint_b nvarchar(255)   NOT NULL,
	protocol nvarchar(4)   NOT NULL,
	service_port int NULL,
	service_name nvarchar(100)   NULL,
	service_fqdn nvarchar(255)   NULL,
	seen_count bigint DEFAULT 0 NOT NULL,
	host_name nvarchar(255)   NOT NULL,
	pid int NULL,
	process_name nvarchar(255)   NULL,
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
	date_added datetime2 NOT NULL,
	first_seen datetime2 NULL,
	last_seen datetime2 NULL,
	CONSTRAINT PK__top_conn__3213E83F3D907561 PRIMARY KEY (id)
);
 CREATE NONCLUSTERED INDEX IX_top_connections_dates ON test.top_connections (  date_added ASC  , last_seen ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ] ;
 CREATE NONCLUSTERED INDEX IX_top_connections_lookup ON test.top_connections (  endpoint_a ASC  , endpoint_b ASC  , service_port ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ] ;
 CREATE NONCLUSTERED INDEX IX_top_connections_seen ON test.top_connections (  seen_count DESC  , last_seen DESC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ] ;
 CREATE NONCLUSTERED INDEX IX_top_connections_service ON test.top_connections (  service_name ASC  , service_port ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ] ;
ALTER TABLE test.top_connections WITH NOCHECK ADD CONSTRAINT CK_top_connections_protocol CHECK (([protocol]='TCP' OR [protocol]='UDP'));
