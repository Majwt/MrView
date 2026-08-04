using Api.Auth;
using Api.Database;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;

namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    [HttpGet("config")]
    [AllowAnonymous]
    public IResult GetConfig([FromServices] IConfiguration config)
    {
        var authority = config["Oidc:Authority"];
        return Results.Ok(new
        {
            oidc_enabled = !string.IsNullOrEmpty(authority),
            oidc_authority = authority ?? "",
            oidc_client_id = config["Oidc:ClientId"] ?? "",
            oidc_scope = "openid profile",
        });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IResult> Login(
        [FromBody] LoginRequest request,
        [FromServices] IConfiguration config,
        [FromServices] IAuthSessionRepository authSessionRepository,
        [FromServices] TokenService tokenService)
    {
        if (string.IsNullOrEmpty(config["Jwt:SigningKey"]))
        {
            return Results.Problem("Login endpoint not available: Jwt:SigningKey is not configured.");
        }

        var users = config.GetSection("Auth:Users").Get<List<AuthUser>>() ?? [];
        var match = users.FirstOrDefault(user =>
            user.Username == request.Username && user.Password == request.Password);

        if (match is null)
        {
            return Results.Unauthorized();
        }

        var sessionId = await authSessionRepository.CreateSessionAsync(match.Username, match.Role, match.CustomerId);
        var (rawToken, hash) = tokenService.GenerateRefreshToken();
        await authSessionRepository.CreateRefreshTokenAsync(
            sessionId,
            Guid.NewGuid(),
            hash,
            DateTime.UtcNow.AddDays(tokenService.RefreshTokenDays));

        RefreshTokenCookieWriter.SetRefreshCookie(HttpContext, rawToken, tokenService.RefreshTokenDays);

        return Results.Ok(new
        {
            token = tokenService.MintAccessToken(
                sessionId.ToString(),
                match.Username,
                match.Role,
                match.CustomerId),
        });
    }

    [HttpPost("oidc-exchange")]
    [AllowAnonymous]
    public async Task<IResult> OidcExchange(
        [FromBody] OidcExchangeRequest request,
        [FromServices] IConfiguration config,
        [FromServices] IServiceProvider serviceProvider,
        [FromServices] IAuthSessionRepository authSessionRepository,
        [FromServices] TokenService tokenService)
    {
        var key = config["Jwt:SigningKey"];
        if (string.IsNullOrEmpty(key))
        {
            return Results.Problem("Local signing key not configured.");
        }

        var oidcConfigManager = serviceProvider.GetService<IConfigurationManager<OpenIdConnectConfiguration>>();
        if (oidcConfigManager is null)
        {
            return Results.Problem("OIDC exchange not configured.");
        }

        OpenIdConnectConfiguration discovery;
        try
        {
            discovery = await oidcConfigManager.GetConfigurationAsync(CancellationToken.None);
        }
        catch
        {
            return Results.Problem("Unable to reach OIDC discovery endpoint.");
        }

        var clientId = config["Oidc:ClientId"];
        var validation = new TokenValidationParameters
        {
            IssuerSigningKeys = discovery.SigningKeys,
            ValidIssuer = config["Oidc:Authority"],
            ValidateAudience = !string.IsNullOrEmpty(clientId),
            ValidAudiences = string.IsNullOrEmpty(clientId) ? null : [clientId],
            ValidateLifetime = true,
        };

        ClaimsPrincipal principal;
        try
        {
            principal = new JwtSecurityTokenHandler().ValidateToken(request.Token, validation, out _);
        }
        catch
        {
            return Results.Unauthorized();
        }

        var incoming = principal.FindAll("groups")
            .Concat(principal.FindAll("roles"))
            .Concat(principal.FindAll("role"))
            .Select(claim => claim.Value)
            .ToList();

        string? name = principal.FindFirstValue("name")
            ?? principal.FindFirstValue("preferred_username")
            ?? principal.FindFirstValue("email");
        string? customerIdClaim = principal.FindFirstValue("customer_id")
            ?? principal.FindFirstValue("extension_customer_id");

        if (incoming.Count == 0 && !string.IsNullOrEmpty(discovery.UserInfoEndpoint))
        {
            var httpClient = serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient();
            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", request.Token);

            var response = await httpClient.GetAsync(discovery.UserInfoEndpoint);
            if (response.IsSuccessStatusCode)
            {
                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var root = document.RootElement;

                static string? ReadString(JsonElement element) =>
                    element.ValueKind == JsonValueKind.String ? element.GetString() : element.GetRawText();

                foreach (var property in new[] { "groups", "roles", "role" })
                {
                    if (!root.TryGetProperty(property, out var element))
                    {
                        continue;
                    }

                    incoming.AddRange(element.ValueKind == JsonValueKind.Array
                        ? element.EnumerateArray().Select(item => ReadString(item) ?? "").Where(value => value != "")
                        : [ReadString(element) ?? ""]);
                }

                name ??= root.TryGetProperty("name", out var n) ? ReadString(n)
                    : root.TryGetProperty("preferred_username", out var u) ? ReadString(u)
                    : root.TryGetProperty("email", out var e) ? ReadString(e)
                    : null;

                if (customerIdClaim is null && root.TryGetProperty("customer_id", out var customerIdElement))
                {
                    customerIdClaim = ReadString(customerIdElement);
                }
            }
        }

        var roleMapping = config.GetSection("Oidc:RoleMapping").Get<Dictionary<string, string>>() ?? [];
        string? appRole = roleMapping.Count > 0
            ? incoming.Select(group => roleMapping.GetValueOrDefault(group)).FirstOrDefault(role => role != null)
            : incoming.FirstOrDefault(role => role == "Admin" || role == "Customer");

        if (appRole is null)
        {
            return Results.Forbid();
        }

        var customerId = customerIdClaim != null && int.TryParse(customerIdClaim, out var parsedCustomerId)
            ? parsedCustomerId
            : (int?)null;

        var sessionId = await authSessionRepository.CreateSessionAsync(name ?? "", appRole, customerId);
        var (rawToken, hash) = tokenService.GenerateRefreshToken();
        await authSessionRepository.CreateRefreshTokenAsync(
            sessionId,
            Guid.NewGuid(),
            hash,
            DateTime.UtcNow.AddDays(tokenService.RefreshTokenDays));

        RefreshTokenCookieWriter.SetRefreshCookie(HttpContext, rawToken, tokenService.RefreshTokenDays);

        return Results.Ok(new
        {
            token = tokenService.MintAccessToken(sessionId.ToString(), name ?? "", appRole, customerId),
        });
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IResult> Refresh(
        [FromServices] IAuthSessionRepository authSessionRepository,
        [FromServices] TokenService tokenService)
    {
        var rawToken = HttpContext.Request.Cookies["axilanswer_rt"];
        if (string.IsNullOrEmpty(rawToken))
        {
            return Results.Unauthorized();
        }

        var result = await authSessionRepository.RedeemRefreshTokenAsync(tokenService.HashToken(rawToken));
        if (result is null)
        {
            return Results.Unauthorized();
        }

        var (session, compromised) = result.Value;
        if (compromised)
        {
            HttpContext.Response.Cookies.Delete("axilanswer_rt", new CookieOptions { Path = "/api/auth" });
            return Results.Unauthorized();
        }

        var (nextRawToken, nextHash) = tokenService.GenerateRefreshToken();
        await authSessionRepository.CreateRefreshTokenAsync(
            session.SessionId,
            session.FamilyId,
            nextHash,
            DateTime.UtcNow.AddDays(tokenService.RefreshTokenDays));

        RefreshTokenCookieWriter.SetRefreshCookie(HttpContext, nextRawToken, tokenService.RefreshTokenDays);

        return Results.Ok(new
        {
            token = tokenService.MintAccessToken(
                session.SessionId.ToString(),
                session.Subject,
                session.Role,
                session.CustomerId),
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IResult> Logout(
        ClaimsPrincipal user,
        [FromServices] IAuthSessionRepository authSessionRepository)
    {
        var sessionIdClaim = user.FindFirstValue("sid");
        if (sessionIdClaim != null && Guid.TryParse(sessionIdClaim, out var sessionId))
        {
            await authSessionRepository.RevokeSessionAsync(sessionId, "logout");
        }

        HttpContext.Response.Cookies.Delete("axilanswer_rt", new CookieOptions { Path = "/api/auth" });
        return Results.Ok();
    }
}
