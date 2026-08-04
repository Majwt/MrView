IF OBJECT_ID('dbo.auth_session', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_session (
        session_id      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        subject         NVARCHAR(256)    NOT NULL,
        role_name       NVARCHAR(64)     NOT NULL,
        customer_id     INT              NULL,
        created_at      DATETIME2(0)     NOT NULL DEFAULT SYSUTCDATETIME(),
        revoked_at      DATETIME2(0)     NULL,
        revoked_reason  NVARCHAR(128)    NULL,
        CONSTRAINT PK_auth_session PRIMARY KEY (session_id)
    );
END;
