using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Tests.Services;

public class PasswordHasherServiceTests
{
    private readonly PasswordHasherService _service = new();

    [Fact]
    public void HashPassword_UsesPbkdf2Format()
    {
        var hash = _service.HashPassword("secret123");

        Assert.StartsWith("pbkdf2$", hash);
    }

    [Fact]
    public void VerifyPassword_AcceptsPbkdf2Hash()
    {
        var hash = _service.HashPassword("secret123");

        Assert.True(_service.VerifyPassword("secret123", hash));
        Assert.False(_service.VerifyPassword("wrong", hash));
    }

    [Fact]
    public void VerifyPassword_AcceptsLegacyBcryptHash()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("secret123");

        Assert.True(_service.VerifyPassword("secret123", hash));
        Assert.True(_service.NeedsMigration(hash));
    }
}
