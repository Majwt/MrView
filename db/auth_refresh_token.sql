IF OBJECT_ID('dbo.auth_refresh_token', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_refresh_token (
        token_id    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        session_id  UNIQUEIDENTIFIER NOT NULL,
        -- family groups all tokens descended from the same login so reuse triggers full revocation
        family_id   UNIQUEIDENTIFIER NOT NULL,
        token_hash  VARBINARY(32)    NOT NULL,
        issued_at   DATETIME2(0)     NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at  DATETIME2(0)     NOT NULL,
        consumed_at DATETIME2(0)     NULL,
        revoked_at  DATETIME2(0)     NULL,
        revoked_reason NVARCHAR(128) NULL,
        CONSTRAINT PK_auth_refresh_token PRIMARY KEY (token_id),
        CONSTRAINT FK_art_session FOREIGN KEY (session_id) REFERENCES dbo.auth_session(session_id)
    );

    CREATE UNIQUE INDEX UX_auth_refresh_token_hash
        ON dbo.auth_refresh_token (token_hash);

    CREATE NONCLUSTERED INDEX IX_auth_refresh_token_session
        ON dbo.auth_refresh_token (session_id, expires_at);

    -- active-token lookup; filtered on base columns per SQL Server filtered-index rules
    CREATE NONCLUSTERED INDEX IX_auth_refresh_token_family_active
        ON dbo.auth_refresh_token (family_id)
        WHERE revoked_at IS NULL AND consumed_at IS NULL;
END;
