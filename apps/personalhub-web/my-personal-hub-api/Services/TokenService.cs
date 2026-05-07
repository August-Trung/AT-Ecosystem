using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using my_personal_hub_api.Models;

namespace my_personal_hub_api.Services;

public class TokenService(IDataProtectionProvider provider, IConfiguration configuration)
{
    private readonly IDataProtector _protector = provider.CreateProtector("MyPersonalHubApi.Token.v1");
    private readonly int _expiryHours = configuration.GetValue<int?>("Auth:TokenExpiryHours") ?? 168;

    public string GenerateToken(CurrentUserContext user)
    {
        var payload = new TokenPayload(user.Id, user.Email, user.Role, DateTimeOffset.UtcNow.AddHours(_expiryHours));
        var json = JsonSerializer.Serialize(payload);
        return _protector.Protect(json);
    }

    public CurrentUserContext? ValidateToken(string token)
    {
        try
        {
            var json = _protector.Unprotect(token);
            var payload = JsonSerializer.Deserialize<TokenPayload>(json);
            if (payload is null || payload.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                return null;
            }

            return new CurrentUserContext(payload.Id, payload.Email, payload.Role);
        }
        catch
        {
            return null;
        }
    }

    private sealed record TokenPayload(int Id, string Email, string Role, DateTimeOffset ExpiresAt);
}
