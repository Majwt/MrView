

CREATE TABLE [test].[connections] (
    [Id] [bigint] IDENTITY(1,1) NOT NULL,

    [CmdbCiId] [nvarchar](128) NULL,
    [Customer] [nvarchar](100) NULL,
    [CustomerID] [int] NULL,

    [HostName] [nvarchar](255) NOT NULL,
    [Fqdn] [nvarchar](255) NOT NULL,

    [ProcessName] [nvarchar](255) NULL,
    [ProcessID] [int] NULL,

    [Protocol] [nvarchar](20) NOT NULL,
    [Direction] [nvarchar](20) NOT NULL,

    [LocalFqdn] [nvarchar](255) NULL,
    [LocalAddressIPv4] [varchar](45) NOT NULL,
    [LocalSubnet] [varchar](45) NULL,
    [LocalPort] [int] NOT NULL,

    [RemoteFqdn] [nvarchar](255) NULL,
    [RemoteAddressIPv4] [varchar](45) NOT NULL,
    [TargetSubnet] [varchar](45) NULL,
    [RemotePort] [int] NOT NULL,

    [State] [nvarchar](50) NULL,
    [DateAdded] [datetime2] NOT NULL
        CONSTRAINT [DF_NetStatInfo_DateAdded] DEFAULT sysdatetime(),

    CONSTRAINT [PK_NetStatInfo] PRIMARY KEY ([Id]),

    CONSTRAINT [CK_NetStatInfo_Direction]
        CHECK ([Direction] IN ('Unknown', 'Incoming', 'Outgoing')),

    CONSTRAINT [CK_NetStatInfo_Protocol]
        CHECK ([Protocol] IN ('TCP', 'UDP'))
);
