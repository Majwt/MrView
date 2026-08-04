namespace Api.Auth;

public class AuthUser
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "";
    public int? CustomerId { get; set; }
}
