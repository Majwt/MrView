using Microsoft.Data.SqlClient;

namespace Api.Database;

public class AuthSessionRepository : IAuthSessionRepository
{
    private readonly string _connectionString;

    public AuthSessionRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString(Config.CONNECTION_STRING_NAME)
            ?? throw new InvalidOperationException("Missing connection string.");
    }

    public async Task<Guid> CreateSessionAsync(string subject, string role, int? customerId)
    {
        var id = Guid.NewGuid();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(
            "INSERT INTO dbo.auth_session (session_id, subject, role_name, customer_id) VALUES (@id, @sub, @role, @cid)",
            connection);

        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@sub", subject);
        command.Parameters.AddWithValue("@role", role);
        command.Parameters.Add(new SqlParameter("@cid", System.Data.SqlDbType.Int)
        {
            Value = (object?)customerId ?? DBNull.Value,
        });

        await command.ExecuteNonQueryAsync();
        return id;
    }

    public async Task CreateRefreshTokenAsync(Guid sessionId, Guid familyId, byte[] tokenHash, DateTime expiresAt)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(
            "INSERT INTO dbo.auth_refresh_token (token_id, session_id, family_id, token_hash, expires_at) VALUES (NEWID(), @sid, @fid, @hash, @exp)",
            connection);

        command.Parameters.AddWithValue("@sid", sessionId);
        command.Parameters.AddWithValue("@fid", familyId);
        command.Parameters.Add(new SqlParameter("@hash", System.Data.SqlDbType.VarBinary, 32)
        {
            Value = tokenHash,
        });
        command.Parameters.AddWithValue("@exp", expiresAt);

        await command.ExecuteNonQueryAsync();
    }

    public async Task<(AuthSessionInfo Session, bool Compromised)?> RedeemRefreshTokenAsync(byte[] tokenHash)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand("""
            SELECT rt.token_id, rt.session_id, rt.family_id,
                   rt.consumed_at, rt.revoked_at, rt.expires_at,
                   s.subject, s.role_name, s.customer_id, s.revoked_at
            FROM dbo.auth_refresh_token rt
            JOIN dbo.auth_session s ON s.session_id = rt.session_id
            WHERE rt.token_hash = @hash
            """, connection);
        command.Parameters.Add(new SqlParameter("@hash", System.Data.SqlDbType.VarBinary, 32) { Value = tokenHash });

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        var tokenId = reader.GetGuid(0);
        var sessionId = reader.GetGuid(1);
        var familyId = reader.GetGuid(2);
        var consumedAt = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3);
        var revokedAt = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4);
        var expiresAt = reader.GetDateTime(5);
        var subject = reader.GetString(6);
        var role = reader.GetString(7);
        var customerId = reader.IsDBNull(8) ? (int?)null : reader.GetInt32(8);
        var sessionRevoked = reader.IsDBNull(9) ? (DateTime?)null : reader.GetDateTime(9);

        await reader.DisposeAsync();

        if (sessionRevoked.HasValue)
        {
            return null;
        }

        var info = new AuthSessionInfo(sessionId, subject, role, customerId, familyId);

        if (consumedAt.HasValue || revokedAt.HasValue)
        {
            await RevokeFamilyInternalAsync(familyId, "reuse-detected", connection);
            return (info, true);
        }

        if (expiresAt < DateTime.UtcNow)
        {
            return null;
        }

        await using var consume = new SqlCommand(
            "UPDATE dbo.auth_refresh_token SET consumed_at = SYSUTCDATETIME() WHERE token_id = @id",
            connection);
        consume.Parameters.AddWithValue("@id", tokenId);
        await consume.ExecuteNonQueryAsync();

        return (info, false);
    }

    public async Task RevokeSessionAsync(Guid sessionId, string reason)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var sessionCommand = new SqlCommand(
            "UPDATE dbo.auth_session SET revoked_at = SYSUTCDATETIME(), revoked_reason = @r WHERE session_id = @id AND revoked_at IS NULL",
            connection);
        sessionCommand.Parameters.AddWithValue("@id", sessionId);
        sessionCommand.Parameters.AddWithValue("@r", reason);
        await sessionCommand.ExecuteNonQueryAsync();

        await using var tokenCommand = new SqlCommand(
            "UPDATE dbo.auth_refresh_token SET revoked_at = SYSUTCDATETIME(), revoked_reason = @r WHERE session_id = @id AND revoked_at IS NULL AND consumed_at IS NULL",
            connection);
        tokenCommand.Parameters.AddWithValue("@id", sessionId);
        tokenCommand.Parameters.AddWithValue("@r", reason);
        await tokenCommand.ExecuteNonQueryAsync();
    }

    private static async Task RevokeFamilyInternalAsync(Guid familyId, string reason, SqlConnection connection)
    {
        await using var revokeTokens = new SqlCommand(
            "UPDATE dbo.auth_refresh_token SET revoked_at = SYSUTCDATETIME(), revoked_reason = @r WHERE family_id = @fid AND revoked_at IS NULL",
            connection);
        revokeTokens.Parameters.AddWithValue("@fid", familyId);
        revokeTokens.Parameters.AddWithValue("@r", reason);
        await revokeTokens.ExecuteNonQueryAsync();

        await using var revokeSession = new SqlCommand("""
            UPDATE s SET s.revoked_at = SYSUTCDATETIME(), s.revoked_reason = @r
            FROM dbo.auth_session s
            JOIN dbo.auth_refresh_token rt ON rt.session_id = s.session_id
            WHERE rt.family_id = @fid AND s.revoked_at IS NULL
            """, connection);
        revokeSession.Parameters.AddWithValue("@fid", familyId);
        revokeSession.Parameters.AddWithValue("@r", reason);
        await revokeSession.ExecuteNonQueryAsync();
    }
}
