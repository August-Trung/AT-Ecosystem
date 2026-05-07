using System.Security.Claims;
using my_personal_hub_api.Models;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Infrastructure;

public class TokenAuthenticationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TokenService tokenService)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization) && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authorization[7..].Trim();
            var user = tokenService.ValidateToken(token);
            if (user is not null)
            {
                context.Items["CurrentUser"] = user;
                context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role)
                ], "CustomBearer"));
            }
        }

        await next(context);
    }
}
