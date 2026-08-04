using Api.Auth;
using Api.Database;
using Api.Extensions;
using Api.Models;
using Api.Services;
using Api.Serialization;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services
    .AddApiJson()
    .AddDatabaseOptions(builder.Configuration)
    .AddApiCore()
    .AddApiAuthentication(builder.Configuration);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

app.MapHealthChecks("/api/healthz");
app.MapHealthChecks("/");

app.MapGet("/api/auth/config", (IConfiguration config) =>
{
    var authority = config["Oidc:Authority"];
    return Results.Ok(new
    {
        oidc_enabled = !string.IsNullOrEmpty(authority),
        oidc_authority = authority ?? "",
        oidc_client_id = config["Oidc:ClientId"] ?? "",
        oidc_scope = "openid profile",
    });
});

app.MapPost("/api/auth/login", async (LoginRequest req, IConfiguration config, Db db, TokenService ts, HttpContext ctx) =>
{
    if (string.IsNullOrEmpty(config["Jwt:SigningKey"]))
        return Results.Problem("Login endpoint not available: Jwt:SigningKey is not configured.");

    var users = config.GetSection("Auth:Users").Get<List<AuthUser>>() ?? [];
    var match = users.FirstOrDefault(u =>
        u.Username == req.Username && u.Password == req.Password);

    if (match is null)
        return Results.Unauthorized();

    var sessionId = await db.CreateSessionAsync(match.Username, match.Role, match.CustomerId);
    var (raw, hash) = ts.GenerateRefreshToken();
    await db.CreateRefreshTokenAsync(sessionId, Guid.NewGuid(), hash, DateTime.UtcNow.AddDays(ts.RefreshTokenDays));
    RefreshTokenCookieWriter.SetRefreshCookie(ctx, raw, ts.RefreshTokenDays);
    return Results.Ok(new { token = ts.MintAccessToken(sessionId.ToString(), match.Username, match.Role, match.CustomerId) });
});

app.MapPost("/api/auth/oidc-exchange", async (OidcExchangeRequest req, IConfiguration config, IServiceProvider sp, Db db, TokenService ts, HttpContext ctx) =>
{
    var key = config["Jwt:SigningKey"];
    if (string.IsNullOrEmpty(key))
        return Results.Problem("Local signing key not configured.");

    var oidcConfigMgr = sp.GetService<IConfigurationManager<OpenIdConnectConfiguration>>();
    if (oidcConfigMgr is null)
        return Results.Problem("OIDC exchange not configured.");

    OpenIdConnectConfiguration disco;
    try { disco = await oidcConfigMgr.GetConfigurationAsync(CancellationToken.None); }
    catch { return Results.Problem("Unable to reach OIDC discovery endpoint."); }

    var clientId = config["Oidc:ClientId"];
    var validation = new TokenValidationParameters
    {
        IssuerSigningKeys = disco.SigningKeys,
        ValidIssuer = config["Oidc:Authority"],
        ValidateAudience = !string.IsNullOrEmpty(clientId),
        ValidAudiences = string.IsNullOrEmpty(clientId) ? null : [clientId],
        ValidateLifetime = true,
    };

    ClaimsPrincipal principal;
    try { principal = new JwtSecurityTokenHandler().ValidateToken(req.Token, validation, out _); }
    catch { return Results.Unauthorized(); }

    // Groups/roles absent from access token — fetch from userinfo endpoint
    var incomingList = principal.FindAll("groups")
        .Concat(principal.FindAll("roles"))
        .Concat(principal.FindAll("role"))
        .Select(c => c.Value)
        .ToList();

    string? name = principal.FindFirstValue("name") ?? principal.FindFirstValue("preferred_username") ?? principal.FindFirstValue("email");
    string? cid = principal.FindFirstValue("customer_id") ?? principal.FindFirstValue("extension_customer_id");

    if (incomingList.Count == 0 && !string.IsNullOrEmpty(disco.UserInfoEndpoint))
    {
        var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", req.Token);
        var resp = await http.GetAsync(disco.UserInfoEndpoint);
        if (resp.IsSuccessStatusCode)
        {
            var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
            static string? Str(JsonElement e) => e.ValueKind == JsonValueKind.String ? e.GetString() : e.GetRawText();
            foreach (var prop in new[] { "groups", "roles", "role" })
                if (doc.TryGetProperty(prop, out var el))
                    incomingList.AddRange(el.ValueKind == JsonValueKind.Array
                        ? el.EnumerateArray().Select(e => Str(e) ?? "").Where(s => s != "")
                        : [Str(el) ?? ""]);
            name ??= doc.TryGetProperty("name", out var n) ? Str(n)
                   : doc.TryGetProperty("preferred_username", out var u) ? Str(u)
                   : doc.TryGetProperty("email", out var e) ? Str(e) : null;
            if (cid is null && doc.TryGetProperty("customer_id", out var cidEl)) cid = Str(cidEl);
        }
    }

    var roleMapping = config.GetSection("Oidc:RoleMapping").Get<Dictionary<string, string>>() ?? [];
    string? appRole = roleMapping.Count > 0
        ? incomingList.Select(g => roleMapping.GetValueOrDefault(g)).FirstOrDefault(r => r != null)
        : incomingList.FirstOrDefault(r => r == "Admin" || r == "Customer");

    if (appRole is null)
        return Results.Forbid();

    var issuedClaims = new List<Claim> { new("name", name ?? ""), new("role", appRole) };
    if (cid != null) issuedClaims.Add(new Claim("customer_id", cid));

    var customerIdInt = cid != null && int.TryParse(cid, out var cidParsed) ? cidParsed : (int?)null;
    var sessionId = await db.CreateSessionAsync(name ?? "", appRole, customerIdInt);
    var (raw, hash) = ts.GenerateRefreshToken();
    await db.CreateRefreshTokenAsync(sessionId, Guid.NewGuid(), hash, DateTime.UtcNow.AddDays(ts.RefreshTokenDays));
    RefreshTokenCookieWriter.SetRefreshCookie(ctx, raw, ts.RefreshTokenDays);
    return Results.Ok(new { token = ts.MintAccessToken(sessionId.ToString(), name ?? "", appRole, customerIdInt) });
});

app.MapPost("/api/auth/refresh", async (HttpContext ctx, Db db, TokenService ts) =>
{
    var raw = ctx.Request.Cookies["axilanswer_rt"];
    if (string.IsNullOrEmpty(raw)) return Results.Unauthorized();

    var result = await db.RedeemRefreshTokenAsync(ts.HashToken(raw));
    if (result is null) return Results.Unauthorized();

    var (session, compromised) = result.Value;
    if (compromised)
    {
        ctx.Response.Cookies.Delete("axilanswer_rt", new CookieOptions { Path = "/api/auth" });
        return Results.Unauthorized();
    }

    var (newRaw, newHash) = ts.GenerateRefreshToken();
    await db.CreateRefreshTokenAsync(session.SessionId, session.FamilyId, newHash, DateTime.UtcNow.AddDays(ts.RefreshTokenDays));
    RefreshTokenCookieWriter.SetRefreshCookie(ctx, newRaw, ts.RefreshTokenDays);
    return Results.Ok(new { token = ts.MintAccessToken(session.SessionId.ToString(), session.Subject, session.Role, session.CustomerId) });
});

app.MapPost("/api/auth/logout", async (ClaimsPrincipal user, HttpContext ctx, Db db) =>
{
    var sid = user.FindFirstValue("sid");
    if (sid != null && Guid.TryParse(sid, out var sessionId))
        await db.RevokeSessionAsync(sessionId, "logout");
    ctx.Response.Cookies.Delete("axilanswer_rt", new CookieOptions { Path = "/api/auth" });
    return Results.Ok();
}).RequireAuthorization();

// Layout:

// /api/graph - returns the full graph snapshot with cursor, use same function but just a zero cursor to get the full snapshot
// /api/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta since the provided cursor
//
// /api/customer/{id}/graph - returns the full graph snapshot for a specific customer with cursor
// /api/customer/{id}/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta for a specific customer since the provided cursor
//
// /api/customers - All customers in a list with ids and names, so the client can know which customer ids to use for the above endpoints

app.MapGet(
    "/api/graph",
    async (ClaimsPrincipal user, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, bool? managedOnly, bool? distinctEdgesOnly, GraphService graphService) =>
    {
        var correct = DateTime.TryParse(
            lastSeen,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out DateTime parsedLastSeen
        );
        if (!correct)
        {
            parsedLastSeen = DateTime.UnixEpoch;
            app.Logger.LogWarning(
                "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
                lastSeen
            );
        }

        var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
        var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours, ManagedOnly: managedOnly ?? false, DistinctEdgesOnly: distinctEdgesOnly ?? false);

        if (user.IsInRole("Admin"))
            return Results.Ok(await graphService.GetGraphAsync(cursor, queryParams: queryParams));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await graphService.GetGraphAsync(cursor, customerId, queryParams));
    }
).RequireAuthorization();

app.MapGet("/api/customer/{customerId}/graph", async (int customerId, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, bool? managedOnly, bool? distinctEdgesOnly, GraphService graphService) =>
{
    var correct = DateTime.TryParse(
        lastSeen,
        CultureInfo.InvariantCulture,
        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
        out DateTime parsedLastSeen
    );
    if (!correct)
    {
        parsedLastSeen = DateTime.UnixEpoch;
        app.Logger.LogDebug(
            "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
            lastSeen
        );
    }

    var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
    var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours, ManagedOnly: managedOnly ?? false, DistinctEdgesOnly: distinctEdgesOnly ?? false);
    app.Logger.LogInformation(
        "Received request for customer {0} with cursor: lastSeen={1}, lastEdgeId={2}, lastNodeId={3}",
        customerId,
        parsedLastSeen,
        lastEdgeId ?? 0,
        lastNodeId ?? 0
    );

    return await graphService.GetGraphAsync(cursor, customerId, queryParams);
}).RequireAuthorization("AdminOnly");

app.MapGet(
    "/api/node",
    async (ClaimsPrincipal user, string ciid, GraphService graphService) =>
    {
        if (string.IsNullOrWhiteSpace(ciid))
            return Results.BadRequest("ciid is required");

        var details = await graphService.GetNodeDetailsAsync(ciid);
        if (details is null) return Results.NotFound();

        if (!user.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(user);
            if (customerIdClaim == null || !long.TryParse(customerIdClaim, out var customerId) || details.Customer.Id != customerId)
                return Results.Forbid();
        }

        return Results.Ok(details);
    }
).RequireAuthorization();

app.MapGet(
    "/api/nodes/filter",
    async (ClaimsPrincipal user, string? customer, string? ip, string? mac,
           string? firstSeenAfter, string? firstSeenBefore,
           string? lastSeenAfter, string? lastSeenBefore,
           GraphService graphService) =>
    {
        DateTime? ParseDate(string? value) =>
            value != null && DateTime.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt) ? dt : null;

        int? scopeCustomerId = null;
        if (!user.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(user);
            if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var cid))
                return Results.Forbid();
            scopeCustomerId = cid;
            customer = null; // prevent leaking other customer names via filter
        }

        var ciids = await graphService.FilterNodeCiidsAsync(
            customer, ip, mac,
            ParseDate(firstSeenAfter), ParseDate(firstSeenBefore),
            ParseDate(lastSeenAfter), ParseDate(lastSeenBefore),
            scopeCustomerId);

        return Results.Ok(ciids);
    }
).RequireAuthorization();

app.MapGet(
    "/api/customers",
    async (CustomerService customerService) => await customerService.GetCustomerAsync()
).RequireAuthorization("AdminOnly");

app.MapGet(
    "/api/dashboard/stats",
    async (ClaimsPrincipal user, DashboardService dashboardService) =>
    {
        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetStatsAsync());

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetStatsAsync(customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/connections-history",
    async (ClaimsPrincipal user, int? days, DashboardService dashboardService) =>
    {
        var effectiveDays = days is > 0 ? days.Value : 90;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays, customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/top-connections",
    async (ClaimsPrincipal user, int? limit, DashboardService dashboardService) =>
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit, customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/nodes",
    async (ClaimsPrincipal user, int? limit, DashboardService dashboardService) =>
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit, customerId));
    }
).RequireAuthorization();

try
{
    app.Run();
}
catch (OperationCanceledException) { }
