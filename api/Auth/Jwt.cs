using System.Security.Claims;

namespace Api.Auth;

// Resolves customer_id from both local tokens and OIDC extension attributes.
public static class Jwt
{
    public static string? CustomerIdClaim(ClaimsPrincipal user) =>
        user.FindFirstValue("customer_id") ?? user.FindFirstValue("extension_customer_id");
}
