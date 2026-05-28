
CREATE TABLE axinetstat.[test].[connections] (
    [Id] [bigint] IDENTITY(1,1) NOT NULL,

    [HostName] [nvarchar](255) NOT NULL,

    [ProcessName] [nvarchar](255) NULL,
    [ProcessID] [int] NULL,

    [Protocol] [nvarchar](20) NOT NULL,
    [Direction] [nvarchar](20) NOT NULL,

    [LocalFqdn] [nvarchar](255) NULL,
    [LocalAddressIPv4] [varchar](45) NOT NULL,
    [LocalPort] [int] NOT NULL,

    [RemoteFqdn] [nvarchar](255) NULL,
    [RemoteAddressIPv4] [varchar](45) NOT NULL,
    [RemotePort] [int] NOT NULL,

    [State] [nvarchar](50) NULL,
    [DateAdded] [datetime2] NOT NULL
        CONSTRAINT [DF_CONNECTIONS_DateAdded] DEFAULT sysdatetime(),

    CONSTRAINT [PK_CONNECTIONS] PRIMARY KEY ([Id]),

    CONSTRAINT [CK_CONNECTIONS_Direction]
        CHECK ([Direction] IN ('Unknown', 'Incoming', 'Outgoing')),

    CONSTRAINT [CK_CONNECTIONS_Protocol]
        CHECK ([Protocol] IN ('TCP', 'UDP'))
);
