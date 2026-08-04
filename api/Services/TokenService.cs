using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Api.Services;

public class TokenService(IConfiguration config)
{
    public int RefreshTokenDays => int.TryParse(config["Jwt:RefreshTokenDays"], out var d) ? d : 7;

    public string MintAccessToken(string sessionId, string subject, string role, int? customerId)
    {
        var rawKey = config["Jwt:SigningKey"]
            ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.");

        var minutes = int.TryParse(config["Jwt:AccessTokenMinutes"], out var m) ? m : 15;

        var claims = new List<Claim>
        {
            new("jti", Guid.NewGuid().ToString()),
            new("sid", sessionId),
            new("name", subject),
            new("role", role),
        };
        if (customerId.HasValue)
            claims.Add(new Claim("customer_id", customerId.Value.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(rawKey));
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string raw, byte[] hash) GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var raw = Convert.ToBase64String(bytes);
        return (raw, HashToken(raw));
    }

    public byte[] HashToken(string raw) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(raw));
}
