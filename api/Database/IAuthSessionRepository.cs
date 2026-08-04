namespace Api.Database;

public interface IAuthSessionRepository
{
    Task<Guid> CreateSessionAsync(string subject, string role, int? customerId);
    Task CreateRefreshTokenAsync(Guid sessionId, Guid familyId, byte[] tokenHash, DateTime expiresAt);
    Task<(Db.AuthSessionInfo Session, bool Compromised)?> RedeemRefreshTokenAsync(byte[] tokenHash);
    Task RevokeSessionAsync(Guid sessionId, string reason);
}
