using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace my_personal_hub_api.Services;

public class OAuthStateService(IDataProtectionProvider provider)
{
    private readonly IDataProtector _protector = provider.CreateProtector("MyPersonalHubApi.OAuthState.v1");

    public string Protect(string provider, string? returnUrl)
    {
        var payload = JsonSerializer.Serialize(new OAuthState(provider, returnUrl, DateTimeOffset.UtcNow.AddMinutes(10)));
        return _protector.Protect(payload);
    }

    public (string Provider, string? ReturnUrl)? Unprotect(string state)
    {
        try
        {
            var json = _protector.Unprotect(state);
            var payload = JsonSerializer.Deserialize<OAuthState>(json);
            if (payload is null || payload.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                return null;
            }

            return (payload.Provider, payload.ReturnUrl);
        }
        catch
        {
            return null;
        }
    }

    private sealed record OAuthState(string Provider, string? ReturnUrl, DateTimeOffset ExpiresAt);
}
