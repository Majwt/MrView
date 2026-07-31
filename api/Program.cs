using Api.Database;
using Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System
        .Text
        .Json
        .JsonNamingPolicy
        .SnakeCaseLower;
    options.SerializerOptions.Converters.Add(new UtcDateTimeConverter());
});
builder.Configuration.AddEnvironmentVariables();

builder
    .Services.AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection("Database"))
    .Validate(
        o =>
            o.IsValid()
            && builder.Configuration.GetConnectionString(Config.CONNECTION_STRING_NAME) != null,
        "Invalid database configuration. \nOne of the following conditions is not met: \n"
            + "1. EdgeTable, NodeTable, InterfaceTable, and PortsTable must be in the format [schema].[table] or schema.table, where schema and table consist of letters, numbers, or underscores. \n"
            + "2. SeenCountThreshold must be a non-negative integer. \n"
            + "3. A valid connection string named 'Default' must be provided in the configuration.\n"
    )
    .ValidateOnStart();

builder.Services.AddScoped<GraphService>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<Db>();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddHealthChecks();
builder.Services.AddHttpClient();

builder.Services.AddEndpointsApiExplorer();

var authority = builder.Configuration["Oidc:Authority"];
var signingKey = builder.Configuration["Jwt:SigningKey"];

var authBuilder = builder.Services.AddAuthentication();
if (!string.IsNullOrEmpty(signingKey))
{
    authBuilder.AddJwtBearer("Local", options =>
    {
        options.TokenValidationParameters.IssuerSigningKey =
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        options.TokenValidationParameters.ValidIssuer = builder.Configuration["Jwt:Issuer"];
        options.TokenValidationParameters.ValidAudience = builder.Configuration["Jwt:Audience"];
        options.MapInboundClaims = true;
    });
}

// ponytail: cached OIDC discovery — only used by the exchange endpoint, not for direct token validation
if (!string.IsNullOrEmpty(authority))
{
    builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(_ =>
        new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{authority}/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever()));
}

builder.Services.AddScoped<IClaimsTransformation, OidcRoleNormalizer>();
builder.Services.AddAuthorization(options =>
{
    var pb = new AuthorizationPolicyBuilder("Local").RequireAuthenticatedUser();
    options.DefaultPolicy = pb.Build();
    options.AddPolicy("AdminOnly", policy => policy.AddAuthenticationSchemes("Local").RequireRole("Admin"));
});

var app = builder.Build();


app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

app.MapHealthChecks("/api/healthz");
app.MapHealthChecks("/");

app.MapPost("/api/auth/login", (LoginRequest req, IConfiguration config) =>
{
    var signingKey = config["Jwt:SigningKey"];
    if (string.IsNullOrEmpty(signingKey))
        return Results.Problem("Login endpoint not available: Jwt:SigningKey is not configured.");

    var users = config.GetSection("Auth:Users").Get<List<AuthUser>>() ?? [];
    var match = users.FirstOrDefault(u =>
        u.Username == req.Username && u.Password == req.Password);

    if (match is null)
        return Results.Unauthorized();

    var claims = new List<Claim>
    {
        new("name", match.Username),
        new("role", match.Role),
    };
    if (match.CustomerId.HasValue)
        claims.Add(new Claim("customer_id", match.CustomerId.Value.ToString()));

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
    var token = new JwtSecurityToken(
        issuer: config["Jwt:Issuer"],
        audience: config["Jwt:Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
    );

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
});

app.MapPost("/api/auth/oidc-exchange", async (OidcExchangeRequest req, IConfiguration config, IServiceProvider sp) =>
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

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    var issued = new JwtSecurityToken(
        issuer: config["Jwt:Issuer"],
        audience: config["Jwt:Audience"],
        claims: issuedClaims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256)
    );
    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(issued) });
});

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
    async (ClaimsPrincipal user, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, GraphService graphService) =>
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
        var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours);

        if (user.IsInRole("Admin"))
            return Results.Ok(await graphService.GetGraphAsync(cursor, queryParams: queryParams));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await graphService.GetGraphAsync(cursor, customerId, queryParams));
    }
).RequireAuthorization();

app.MapGet("/api/customer/{customerId}/graph", async (int customerId, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, GraphService graphService) =>
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
    var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours);
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

try
{
    app.Run();
}
catch (OperationCanceledException) { }

class AuthUser
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "";
    public int? CustomerId { get; set; }
}

record LoginRequest(string Username, string Password);
record OidcExchangeRequest(string Token);

// ponytail: forces "Z" suffix on all DateTime outputs regardless of Kind
class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => DateTime.SpecifyKind(reader.GetDateTime(), DateTimeKind.Utc);

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        => writer.WriteStringValue(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}

// Maps Entra ID "roles" array to ClaimTypes.Role so IsInRole() works for all providers
class OidcRoleNormalizer : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var roles = principal.FindAll("roles").ToList();
        if (roles.Count == 0 || principal.HasClaim(c => c.Type == ClaimTypes.Role))
            return Task.FromResult(principal);

        var identity = new ClaimsIdentity();
        foreach (var r in roles) identity.AddClaim(new Claim(ClaimTypes.Role, r.Value));
        principal.AddIdentity(identity);
        return Task.FromResult(principal);
    }
}

// Resolves customer_id from both our tokens and Entra ID extension attributes
static class Jwt
{
    public static string? CustomerIdClaim(ClaimsPrincipal user) =>
        user.FindFirstValue("customer_id") ?? user.FindFirstValue("extension_customer_id");
}
