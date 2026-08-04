using Api.Auth;
using Api.Database;
using Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiJson(this IServiceCollection services)
    {
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
            options.SerializerOptions.Converters.Add(new Serialization.UtcDateTimeConverter());
        });

        return services;
    }

    public static IServiceCollection AddDatabaseOptions(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<DatabaseOptions>()
            .Bind(configuration.GetSection("Database"))
            .Validate(
                options => options.IsValid() && configuration.GetConnectionString(Config.CONNECTION_STRING_NAME) != null,
                "Invalid database configuration. \nOne of the following conditions is not met: \n"
                    + "1. EdgeTable, NodeTable, InterfaceTable, and PortsTable must be in the format [schema].[table] or schema.table, where schema and table consist of letters, numbers, or underscores. \n"
                    + "2. SeenCountThreshold must be a non-negative integer. \n"
                    + "3. A valid connection string named 'Default' must be provided in the configuration.\n"
            )
            .ValidateOnStart();

        return services;
    }

    public static IServiceCollection AddApiCore(this IServiceCollection services)
    {
        services.AddScoped<GraphService>();
        services.AddScoped<CustomerService>();
        services.AddScoped<DashboardService>();
        services.AddScoped<TokenService>();
        services.AddSingleton<IGraphReadRepository, GraphReadRepository>();
        services.AddSingleton<IDashboardReadRepository, DashboardReadRepository>();
        services.AddSingleton<ICustomerReadRepository, CustomerReadRepository>();
        services.AddSingleton<IAuthSessionRepository, AuthSessionRepository>();
        services.AddControllers();

        services.AddResponseCompression(options => { options.EnableForHttps = true; });
        services.AddHealthChecks();
        services.AddHttpClient();
        services.AddEndpointsApiExplorer();

        return services;
    }

    public static IServiceCollection AddApiAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var authority = configuration["Oidc:Authority"];
        var signingKey = configuration["Jwt:SigningKey"];

        var authBuilder = services.AddAuthentication();
        if (!string.IsNullOrEmpty(signingKey))
        {
            authBuilder.AddJwtBearer("Local", options =>
            {
                options.TokenValidationParameters.IssuerSigningKey =
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
                options.TokenValidationParameters.ValidIssuer = configuration["Jwt:Issuer"];
                options.TokenValidationParameters.ValidAudience = configuration["Jwt:Audience"];
                options.MapInboundClaims = true;
            });
        }

        if (!string.IsNullOrEmpty(authority))
        {
            services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(_ =>
                new ConfigurationManager<OpenIdConnectConfiguration>(
                    $"{authority}/.well-known/openid-configuration",
                    new OpenIdConnectConfigurationRetriever()));
        }

        services.AddScoped<IClaimsTransformation, OidcRoleNormalizer>();
        services.AddAuthorization(options =>
        {
            var policyBuilder = new AuthorizationPolicyBuilder("Local").RequireAuthenticatedUser();
            options.DefaultPolicy = policyBuilder.Build();
            options.AddPolicy(
                "AdminOnly",
                policy => policy.AddAuthenticationSchemes("Local").RequireRole("Admin"));
        });

        return services;
    }
}
