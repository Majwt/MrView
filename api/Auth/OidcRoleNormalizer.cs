using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;

namespace Api.Auth;

// Maps Entra ID "roles" array to ClaimTypes.Role so IsInRole works consistently.
public class OidcRoleNormalizer : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var roles = principal.FindAll("roles").ToList();
        if (roles.Count == 0 || principal.HasClaim(c => c.Type == ClaimTypes.Role))
        {
            return Task.FromResult(principal);
        }

        var identity = new ClaimsIdentity();
        foreach (var role in roles)
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, role.Value));
        }

        principal.AddIdentity(identity);
        return Task.FromResult(principal);
    }
}
