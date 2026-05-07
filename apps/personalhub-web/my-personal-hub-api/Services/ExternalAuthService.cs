using System.Net.Http.Headers;
using System.Text.Json;
using Google.Apis.Auth;

namespace my_personal_hub_api.Services;

public class ExternalAuthService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
{
    public bool IsGoogleConfigured => !string.IsNullOrWhiteSpace(configuration["AuthProviders:Google:ClientId"]);
    public bool IsGitHubConfigured =>
        !string.IsNullOrWhiteSpace(configuration["AuthProviders:GitHub:ClientId"]) &&
        !string.IsNullOrWhiteSpace(configuration["AuthProviders:GitHub:ClientSecret"]) &&
        !string.IsNullOrWhiteSpace(configuration["AuthProviders:GitHub:RedirectUri"]);

    public async Task<ExternalUserInfo> VerifyGoogleIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        var clientId = configuration["AuthProviders:Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new InvalidOperationException("Google login is not configured.");
        }

        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = [clientId]
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        return new ExternalUserInfo(
            "google",
            payload.Subject,
            payload.Email ?? $"google-{payload.Subject}@users.local",
            payload.Name,
            payload.Picture);
    }

    public string BuildGitHubAuthorizeUrl(string state)
    {
        var clientId = configuration["AuthProviders:GitHub:ClientId"];
        var redirectUri = configuration["AuthProviders:GitHub:RedirectUri"];
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(redirectUri))
        {
            throw new InvalidOperationException("GitHub login is not configured.");
        }

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["scope"] = "read:user user:email",
            ["state"] = state
        };

        var queryString = string.Join("&", query.Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value ?? string.Empty)}"));
        return $"https://github.com/login/oauth/authorize?{queryString}";
    }

    public async Task<ExternalUserInfo> ExchangeGitHubCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        if (!IsGitHubConfigured)
        {
            throw new InvalidOperationException("GitHub login is not configured.");
        }

        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("MyPersonalHub", "1.0"));

        var tokenResponse = await client.PostAsync("https://github.com/login/oauth/access_token",
            new FormUrlEncodedContent(new Dictionary<string, string?>
            {
                ["client_id"] = configuration["AuthProviders:GitHub:ClientId"],
                ["client_secret"] = configuration["AuthProviders:GitHub:ClientSecret"],
                ["redirect_uri"] = configuration["AuthProviders:GitHub:RedirectUri"],
                ["code"] = code
            }!),
            cancellationToken);

        tokenResponse.EnsureSuccessStatusCode();
        var tokenJson = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
        var token = JsonSerializer.Deserialize<GitHubTokenResponse>(tokenJson);
        if (string.IsNullOrWhiteSpace(token?.access_token))
        {
            throw new InvalidOperationException("Unable to exchange GitHub code.");
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.access_token);
        var userResponse = await client.GetAsync("https://api.github.com/user", cancellationToken);
        userResponse.EnsureSuccessStatusCode();
        var userJson = await userResponse.Content.ReadAsStringAsync(cancellationToken);
        var user = JsonSerializer.Deserialize<GitHubUserResponse>(userJson);

        var emailResponse = await client.GetAsync("https://api.github.com/user/emails", cancellationToken);
        emailResponse.EnsureSuccessStatusCode();
        var emailJson = await emailResponse.Content.ReadAsStringAsync(cancellationToken);
        var emails = JsonSerializer.Deserialize<List<GitHubEmailResponse>>(emailJson) ?? [];
        var primaryEmail = emails.FirstOrDefault(email => email.primary)?.email
            ?? emails.FirstOrDefault()?.email
            ?? $"github-{user?.id}@users.local";

        if (user is null || string.IsNullOrWhiteSpace(user.id))
        {
            throw new InvalidOperationException("Unable to fetch GitHub profile.");
        }

        return new ExternalUserInfo(
            "github",
            user.id,
            primaryEmail,
            user.name ?? user.login,
            user.avatar_url);
    }

    private sealed record GitHubTokenResponse(string access_token);
    private sealed record GitHubUserResponse(string id, string login, string? name, string? avatar_url);
    private sealed record GitHubEmailResponse(string email, bool primary, bool verified);
}

public sealed record ExternalUserInfo(string Provider, string ProviderUserId, string Email, string? FullName, string? AvatarUrl);
