namespace Api.Database;

public record AuthSessionInfo(Guid SessionId, string Subject, string Role, int? CustomerId, Guid FamilyId);
