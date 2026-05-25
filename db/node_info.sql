

CREATE TABLE [test].[node_info] (
    [Id] [bigint] IDENTITY(1,1) NOT NULL,
    [CmdbCiId] [nvarchar](128) NULL,
    [Customer] [nvarchar](100) NULL,
    [CustomerID] [int] NULL,
    [Fqdn] [nvarchar](255) NOT NULL,
    [AddressIPv4] [varchar](45) NOT NULL,
    [Subnet] [varchar](45) NULL,
    [MacAddress] [varchar](45) NOT NULL,
    [DateAdded] [datetime2] NOT NULL
        CONSTRAINT [DF_NODE_INFO_DateAdded] DEFAULT sysdatetime(),
        CONSTRAINT [PK_NODE_INFO] PRIMARY KEY ([Id]),
);
