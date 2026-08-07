USE AxiNetStat;
GO

DROP TABLE IF EXISTS dbo.import_watermark;
GO

CREATE TABLE dbo.import_watermark (
    id              bigint        IDENTITY(1,1) NOT NULL,
    source_key      nvarchar(256) NOT NULL,
    watermark_value datetime2(0)  NOT NULL,
    run_timestamp   datetime2(0)  NOT NULL,

    CONSTRAINT PK_import_watermark PRIMARY KEY (id)
);
GO

-- source_key + watermark_value DESC so MAX() lookups hit the index
CREATE INDEX IX_import_watermark_source_key_watermark_value
ON dbo.import_watermark (source_key, watermark_value DESC, id DESC);
GO
