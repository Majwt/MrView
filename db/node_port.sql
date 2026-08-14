USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.node_port;
GO

CREATE TABLE dbo.node_port (
    id int IDENTITY(1,1) NOT NULL,
    ciid nvarchar(128) NOT NULL,
    proto varchar(10) NOT NULL,
    recv_q int NULL,
    send_q int NULL,
    local_ip varchar(255) NULL,
    local_port varchar(10) NULL,
    foreign_ip varchar(255) NULL,
    foreign_port varchar(10) NULL,
    state varchar(50) NULL,
    pid int NULL,
    [current] bit NOT NULL CONSTRAINT DF_node_port_current DEFAULT (0),
    date_created datetime2(0) NOT NULL,

    CONSTRAINT PK_node_port PRIMARY KEY (id)
);
GO

CREATE INDEX IX_node_port_ciid
ON dbo.node_port (ciid);
GO

CREATE INDEX IX_node_port_local
ON dbo.node_port (local_ip, local_port);
GO

CREATE INDEX IX_node_port_foreign
ON dbo.node_port (foreign_ip, foreign_port);
GO

CREATE INDEX IX_node_port_pid
ON dbo.node_port (pid);
GO
