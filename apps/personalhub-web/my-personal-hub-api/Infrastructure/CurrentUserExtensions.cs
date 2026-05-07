using my_personal_hub_api.Models;

namespace my_personal_hub_api.Infrastructure;

public static class CurrentUserExtensions
{
    public static CurrentUserContext? GetCurrentUser(this HttpContext context)
        => context.Items["CurrentUser"] as CurrentUserContext;

    public static bool IsAdmin(this CurrentUserContext? user)
        => string.Equals(user?.Role, "admin", StringComparison.OrdinalIgnoreCase);

    public static bool OwnsResource(this CurrentUserContext? user, IDictionary<string, object?> row)
    {
        if (user is null)
        {
            return false;
        }

        if (user.IsAdmin())
        {
            return true;
        }

        var ownerId = row.GetNullableInt("UserId");
        return ownerId.HasValue && ownerId.Value == user.Id;
    }
}
