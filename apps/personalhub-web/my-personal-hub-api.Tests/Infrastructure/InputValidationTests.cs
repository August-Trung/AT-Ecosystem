using Microsoft.AspNetCore.Http;
using my_personal_hub_api.Infrastructure;

namespace my_personal_hub_api.Tests.Infrastructure;

public class InputValidationTests
{
    [Theory]
    [InlineData("admin@example.com", true)]
    [InlineData("bad-email", false)]
    public void IsValidEmail_ReturnsExpectedResult(string email, bool expected)
        => Assert.Equal(expected, InputValidation.IsValidEmail(email));

    [Theory]
    [InlineData("https://example.com", true)]
    [InlineData("http://example.com/path", true)]
    [InlineData("javascript:alert(1)", false)]
    public void IsAllowedRedirectUrl_ReturnsExpectedResult(string url, bool expected)
        => Assert.Equal(expected, InputValidation.IsAllowedRedirectUrl(url));

    [Fact]
    public void IsAllowedFile_RejectsDisallowedExtension()
    {
        var stream = new MemoryStream(new byte[10]);
        IFormFile file = new FormFile(stream, 0, stream.Length, "file", "malware.exe");

        Assert.False(InputValidation.IsAllowedFile(file, 1024));
    }
}
