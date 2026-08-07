namespace Api.Auth;

public static class RefreshTokenCookieWriter
{
    public static void SetRefreshCookie(HttpContext context, string rawToken, int days)
    {
        context.Response.Cookies.Append("axilanswer_rt", rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(days),
            Path = "/api/auth",
        });
    }
}
