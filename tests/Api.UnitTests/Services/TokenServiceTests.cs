using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Api.Services;
using Xunit;

namespace Api.UnitTests.Services;

public class TokenServiceTests
{
    [Fact]
    public void RefreshTokenDays_UsesConfiguredValue()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:RefreshTokenDays"] = "14",
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
        });

        Assert.Equal(14, service.RefreshTokenDays);
    }

    [Fact]
    public void RefreshTokenDays_DefaultsToSeven_WhenMissingOrInvalid()
    {
        var missing = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
        });
        var invalid = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:RefreshTokenDays"] = "not-a-number",
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
        });

        Assert.Equal(7, missing.RefreshTokenDays);
        Assert.Equal(7, invalid.RefreshTokenDays);
    }

    [Fact]
    public void MintAccessToken_ContainsExpectedClaims()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
            ["Jwt:Issuer"] = "axilanswer-tests",
            ["Jwt:Audience"] = "axilanswer-client",
            ["Jwt:AccessTokenMinutes"] = "30",
        });

        var token = service.MintAccessToken("sid-123", "theodor", "Admin", 42);

        var parsed = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("axilanswer-tests", parsed.Issuer);
        Assert.Contains("axilanswer-client", parsed.Audiences);
        Assert.Equal("sid-123", parsed.Claims.Single(c => c.Type == "sid").Value);
        Assert.Equal("theodor", parsed.Claims.Single(c => c.Type == "name").Value);
        Assert.Equal("Admin", parsed.Claims.Single(c => c.Type == "role").Value);
        Assert.Equal("42", parsed.Claims.Single(c => c.Type == "customer_id").Value);
        Assert.NotEqual(default, parsed.ValidTo);
        Assert.True(parsed.ValidTo > DateTime.UtcNow);
    }

    [Fact]
    public void MintAccessToken_Throws_WhenSigningKeyIsMissing()
    {
        var service = CreateService(new Dictionary<string, string?>());

        Assert.Throws<InvalidOperationException>(() =>
            service.MintAccessToken("sid-123", "theodor", "Admin", null));
    }

    [Fact]
    public void GenerateRefreshToken_ReturnsHashOfRawToken()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
        });

        var (raw, hash) = service.GenerateRefreshToken();
        var expectedHash = service.HashToken(raw);

        Assert.Equal(32, Convert.FromBase64String(raw).Length);
        Assert.Equal(expectedHash, hash);
    }

    [Fact]
    public void HashToken_IsDeterministic()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "0123456789abcdef0123456789abcdef",
        });

        var left = service.HashToken("same-input");
        var right = service.HashToken("same-input");
        var different = service.HashToken("different-input");

        Assert.Equal(left, right);
        Assert.NotEqual(left, different);
    }

    private static TokenService CreateService(Dictionary<string, string?> values)
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

        return new TokenService(config);
    }
}
