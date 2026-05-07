using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;

namespace my_personal_hub_api.Tests.Infrastructure;

public class CurrentUserExtensionsTests
{
    [Fact]
    public void OwnsResource_ReturnsTrueForMatchingUser()
    {
        var user = new CurrentUserContext(7, "owner@example.com", "user");
        var row = new Dictionary<string, object?> { ["UserId"] = 7 };

        Assert.True(user.OwnsResource(row));
    }

    [Fact]
    public void OwnsResource_ReturnsTrueForAdmin()
    {
        var user = new CurrentUserContext(1, "admin@example.com", "admin");
        var row = new Dictionary<string, object?> { ["UserId"] = 999 };

        Assert.True(user.OwnsResource(row));
    }
}
