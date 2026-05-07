using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    StoredProcedureExecutor db,
    PasswordHasherService passwordHasher,
    TokenService tokenService,
    AuditLogService auditLog,
    PhoneOtpService phoneOtpService,
    ExternalAuthService externalAuthService,
    OAuthStateService oAuthStateService,
    IConfiguration configuration) : ControllerBase
{
    private readonly int _minimumPasswordLength = configuration.GetValue<int?>("Auth:MinimumPasswordLength") ?? 8;
    private readonly string _defaultOAuthSuccessUrl = configuration["Auth:FrontendOAuthSuccessUrl"] ?? "http://localhost:3000/auth/callback";

    [HttpGet("providers")]
    public IActionResult GetProviders()
        => Ok(new ApiResponse(true, "Auth providers retrieved", new
        {
            localEnabled = true,
            googleEnabled = externalAuthService.IsGoogleConfigured,
            githubEnabled = externalAuthService.IsGitHubConfigured,
            phoneOtpEnabled = true,
            phoneOtpLength = phoneOtpService.OtpLength
        }));

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!InputValidation.IsValidEmail(request.Email))
        {
            return BadRequest(new ApiResponse(false, "Email không hợp lệ"));
        }

        if (!InputValidation.IsStrongEnoughPassword(request.Password, _minimumPasswordLength))
        {
            return BadRequest(new ApiResponse(false, $"Mật khẩu phải có ít nhất {_minimumPasswordLength} ký tự"));
        }

        var email = request.Email.Trim();
        var existingUser = await db.QuerySingleAsync("sp_Users_GetByEmail", new StoredProcedureParameter("Email", email));
        if (existingUser is not null)
        {
            return BadRequest(new ApiResponse(false, "Email đã tồn tại"));
        }

        var username = await BuildUniqueUsernameAsync(request.Username, email);
        var createdUser = await CreateUserAsync(new CreateUserOptions(
            username,
            email,
            passwordHasher.HashPassword(request.Password),
            request.FullName?.Trim(),
            "local",
            null,
            null,
            null));

        if (createdUser is null)
        {
            return StatusCode(500, new ApiResponse(false, "Không thể tạo tài khoản"));
        }

        var user = ToUserResponse(createdUser);
        var token = tokenService.GenerateToken(new CurrentUserContext(user.Id, user.Email, user.Role));
        await auditLog.WriteAsync("auth.register", user.Id, "user", user.Id.ToString(), new { user.Email }, HttpContext.RequestAborted);
        return StatusCode(201, new ApiResponse(true, "Đăng ký thành công", new { user, token }));
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new ApiResponse(false, "Vui lòng nhập email và mật khẩu"));
        }

        var userRow = await db.QuerySingleAsync("sp_Users_GetByEmail", new StoredProcedureParameter("Email", request.Email.Trim()));
        if (userRow is null)
        {
            return Unauthorized(new ApiResponse(false, "Email không tồn tại"));
        }

        if (!userRow.GetBool("IsActive"))
        {
            return StatusCode(403, new ApiResponse(false, "Tài khoản đã bị khóa"));
        }

        if (!string.Equals(userRow.GetString("AuthProvider"), "local", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse(false, $"Tài khoản này dùng phương thức đăng nhập {userRow.GetString("AuthProvider")}"));
        }

        var passwordHash = userRow.GetString("Password") ?? string.Empty;
        if (!passwordHasher.VerifyPassword(request.Password, passwordHash))
        {
            return Unauthorized(new ApiResponse(false, "Sai mật khẩu"));
        }

        if (passwordHasher.NeedsMigration(passwordHash))
        {
            var migrated = await db.QuerySingleAsync("sp_Users_Update",
                new StoredProcedureParameter("Id", userRow.GetInt("Id")),
                new StoredProcedureParameter("Username", null),
                new StoredProcedureParameter("Email", null),
                new StoredProcedureParameter("Password", passwordHasher.HashPassword(request.Password)),
                new StoredProcedureParameter("FullName", null),
                new StoredProcedureParameter("Role", null),
                new StoredProcedureParameter("IsActive", null),
                new StoredProcedureParameter("PhoneNumber", null),
                new StoredProcedureParameter("AuthProvider", null),
                new StoredProcedureParameter("ProviderUserId", null),
                new StoredProcedureParameter("AvatarUrl", null),
                new StoredProcedureParameter("PhoneVerifiedAt", null));

            if (migrated is not null)
            {
                userRow = migrated;
            }
        }

        return Ok(new ApiResponse(true, "Đăng nhập thành công", await BuildAuthResponseAsync(userRow, "auth.login")));
    }

    [HttpPost("google")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> LoginWithGoogle([FromBody] GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Credential))
        {
            return BadRequest(new ApiResponse(false, "Thiếu Google credential"));
        }

        var externalUser = await externalAuthService.VerifyGoogleIdTokenAsync(request.Credential, HttpContext.RequestAborted);
        var userRow = await UpsertExternalUserAsync(externalUser);
        if (userRow is null)
        {
            return StatusCode(500, new ApiResponse(false, "Không thể đồng bộ tài khoản Google"));
        }

        return Ok(new ApiResponse(true, "Đăng nhập Google thành công", await BuildAuthResponseAsync(userRow, "auth.login.google")));
    }

    [HttpGet("github/start")]
    public IActionResult GitHubStart([FromQuery] string? returnUrl)
    {
        if (!externalAuthService.IsGitHubConfigured)
        {
            return BadRequest(new ApiResponse(false, "GitHub login chưa được cấu hình"));
        }

        var targetUrl = string.IsNullOrWhiteSpace(returnUrl) ? _defaultOAuthSuccessUrl : returnUrl;
        var state = oAuthStateService.Protect("github", targetUrl);
        var authUrl = externalAuthService.BuildGitHubAuthorizeUrl(state);
        return Redirect(authUrl);
    }

    [HttpGet("github/callback")]
    public async Task<IActionResult> GitHubCallback([FromQuery] string code, [FromQuery] string state)
    {
        var payload = oAuthStateService.Unprotect(state);
        if (payload is null || !string.Equals(payload.Value.Provider, "github", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse(false, "OAuth state không hợp lệ"));
        }

        var externalUser = await externalAuthService.ExchangeGitHubCodeAsync(code, HttpContext.RequestAborted);
        var userRow = await UpsertExternalUserAsync(externalUser);
        if (userRow is null)
        {
            return StatusCode(500, new ApiResponse(false, "Không thể đồng bộ tài khoản GitHub"));
        }

        var authPayload = await BuildAuthResponseAsync(userRow, "auth.login.github");
        var redirectUrl = BuildFrontendCallbackUrl(payload.Value.ReturnUrl ?? _defaultOAuthSuccessUrl, authPayload.Token, authPayload.User.Email);
        return Redirect(redirectUrl);
    }

    [HttpPost("phone/request-otp")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RequestPhoneOtp([FromBody] PhoneOtpRequest request)
    {
        if (!InputValidation.IsValidPhoneNumber(request.PhoneNumber))
        {
            return BadRequest(new ApiResponse(false, "Số điện thoại không hợp lệ"));
        }

        var normalizedPhone = InputValidation.NormalizePhoneNumber(request.PhoneNumber);
        IDictionary<string, object?>? userRow = await db.QuerySingleAsync("sp_Users_GetByPhone", new StoredProcedureParameter("PhoneNumber", normalizedPhone));
        if (userRow is null)
        {
            var syntheticEmail = BuildPhoneEmail(normalizedPhone);
            var username = await BuildUniqueUsernameAsync(request.FullName, syntheticEmail);
            userRow = await CreateUserAsync(new CreateUserOptions(
                username,
                syntheticEmail,
                passwordHasher.HashPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(16))),
                request.FullName?.Trim(),
                "phone",
                null,
                normalizedPhone,
                null));
        }

        if (userRow is null)
        {
            return StatusCode(500, new ApiResponse(false, "Không thể tạo OTP cho tài khoản"));
        }

        var otp = phoneOtpService.GenerateOtp();
        var expiresAt = phoneOtpService.GetExpiryUtc();
        await db.QuerySingleAsync("sp_Users_SetOtp",
            new StoredProcedureParameter("Id", userRow.GetInt("Id")),
            new StoredProcedureParameter("OtpCode", otp),
            new StoredProcedureParameter("OtpExpiresAt", expiresAt));

        await auditLog.WriteAsync("auth.phone.request-otp", userRow.GetInt("Id"), "user", userRow.GetInt("Id").ToString(), new
        {
            phoneNumber = normalizedPhone
        }, HttpContext.RequestAborted);

        return Ok(new ApiResponse(true, "OTP đã được tạo", phoneOtpService.BuildDeliveryPayload(otp)));
    }

    [HttpPost("phone/verify-otp")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyPhoneOtp([FromBody] VerifyPhoneOtpRequest request)
    {
        if (!InputValidation.IsValidPhoneNumber(request.PhoneNumber) || string.IsNullOrWhiteSpace(request.Otp))
        {
            return BadRequest(new ApiResponse(false, "Thiếu số điện thoại hoặc OTP"));
        }

        var normalizedPhone = InputValidation.NormalizePhoneNumber(request.PhoneNumber);
        var userRow = await db.QuerySingleAsync("sp_Users_GetByPhone", new StoredProcedureParameter("PhoneNumber", normalizedPhone));
        if (userRow is null)
        {
            return NotFound(new ApiResponse(false, "Số điện thoại chưa đăng ký"));
        }

        var otpCode = userRow.GetString("OtpCode");
        var otpExpiresAt = userRow.GetDateTime("OtpExpiresAt");
        if (string.IsNullOrWhiteSpace(otpCode) || !string.Equals(otpCode, request.Otp.Trim(), StringComparison.Ordinal))
        {
            return Unauthorized(new ApiResponse(false, "OTP không đúng"));
        }

        if (!otpExpiresAt.HasValue || otpExpiresAt.Value < DateTime.UtcNow)
        {
            return Unauthorized(new ApiResponse(false, "OTP đã hết hạn"));
        }

        var verified = await db.QuerySingleAsync("sp_Users_VerifyPhone", new StoredProcedureParameter("Id", userRow.GetInt("Id")));
        if (verified is null)
        {
            return StatusCode(500, new ApiResponse(false, "Không thể xác thực số điện thoại"));
        }

        return Ok(new ApiResponse(true, "Đăng nhập bằng số điện thoại thành công", await BuildAuthResponseAsync(verified, "auth.login.phone")));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var currentUser = HttpContext.GetCurrentUser();
        await auditLog.WriteAsync("auth.logout", currentUser?.Id, "user", currentUser?.Id.ToString(), null, HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "Đăng xuất thành công"));
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var userRow = await db.QuerySingleAsync("sp_Users_GetById", new StoredProcedureParameter("Id", currentUser.Id));
        return userRow is null
            ? NotFound(new ApiResponse(false, "User không tồn tại"))
            : Ok(new ApiResponse(true, "Lấy thông tin thành công", ToUserResponse(userRow)));
    }

    [HttpPut("profile")]
    [EnableRateLimiting("writes")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (string.IsNullOrWhiteSpace(request.Username) && string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new ApiResponse(false, "Không có dữ liệu để cập nhật"));
        }

        var desiredUsername = request.Username;
        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            desiredUsername = NormalizeUsername(request.Username);
            if (string.IsNullOrWhiteSpace(desiredUsername))
            {
                return BadRequest(new ApiResponse(false, "Username không hợp lệ"));
            }

            var allUsers = await db.QueryAsync("sp_Users_GetAll");
            var duplicate = allUsers.Any(user =>
                user.GetInt("Id") != currentUser.Id &&
                string.Equals(user.GetString("Username"), desiredUsername, StringComparison.OrdinalIgnoreCase));

            if (duplicate)
            {
                return BadRequest(new ApiResponse(false, "Username đã tồn tại"));
            }
        }

        var updatedUser = await db.QuerySingleAsync("sp_Users_Update",
            new StoredProcedureParameter("Id", currentUser.Id),
            new StoredProcedureParameter("Username", desiredUsername),
            new StoredProcedureParameter("Email", null),
            new StoredProcedureParameter("Password", null),
            new StoredProcedureParameter("FullName", request.FullName?.Trim()),
            new StoredProcedureParameter("Role", null),
            new StoredProcedureParameter("IsActive", null),
            new StoredProcedureParameter("PhoneNumber", null),
            new StoredProcedureParameter("AuthProvider", null),
            new StoredProcedureParameter("ProviderUserId", null),
            new StoredProcedureParameter("AvatarUrl", null),
            new StoredProcedureParameter("PhoneVerifiedAt", null));

        await auditLog.WriteAsync("auth.profile.update", currentUser.Id, "user", currentUser.Id.ToString(), new
        {
            username = desiredUsername,
            request.FullName
        }, HttpContext.RequestAborted);

        return Ok(new ApiResponse(true, "Đã cập nhật thông tin", updatedUser is null ? null : ToUserResponse(updatedUser)));
    }

    [HttpPut("change-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new ApiResponse(false, "Vui lòng nhập đầy đủ mật khẩu"));
        }

        if (!InputValidation.IsStrongEnoughPassword(request.NewPassword, _minimumPasswordLength))
        {
            return BadRequest(new ApiResponse(false, $"Mật khẩu mới phải có ít nhất {_minimumPasswordLength} ký tự"));
        }

        var userRow = await db.QuerySingleAsync("sp_Users_GetById", new StoredProcedureParameter("Id", currentUser.Id));
        if (userRow is null)
        {
            return NotFound(new ApiResponse(false, "User không tồn tại"));
        }

        if (!string.Equals(userRow.GetString("AuthProvider"), "local", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse(false, "Tài khoản đăng nhập ngoài không đổi mật khẩu nội bộ"));
        }

        var passwordHash = userRow.GetString("Password") ?? string.Empty;
        if (!passwordHasher.VerifyPassword(request.CurrentPassword, passwordHash))
        {
            return BadRequest(new ApiResponse(false, "Mật khẩu hiện tại không đúng"));
        }

        await db.QuerySingleAsync("sp_Users_Update",
            new StoredProcedureParameter("Id", currentUser.Id),
            new StoredProcedureParameter("Username", null),
            new StoredProcedureParameter("Email", null),
            new StoredProcedureParameter("Password", passwordHasher.HashPassword(request.NewPassword)),
            new StoredProcedureParameter("FullName", null),
            new StoredProcedureParameter("Role", null),
            new StoredProcedureParameter("IsActive", null),
            new StoredProcedureParameter("PhoneNumber", null),
            new StoredProcedureParameter("AuthProvider", null),
            new StoredProcedureParameter("ProviderUserId", null),
            new StoredProcedureParameter("AvatarUrl", null),
            new StoredProcedureParameter("PhoneVerifiedAt", null));

        await auditLog.WriteAsync("auth.password.change", currentUser.Id, "user", currentUser.Id.ToString(), null, HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "Đổi mật khẩu thành công"));
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null || !currentUser.IsAdmin())
        {
            return StatusCode(403, new ApiResponse(false, "Bạn không có quyền xem danh sách user"));
        }

        var users = await db.QueryAsync("sp_Users_GetAll");
        return Ok(new ApiResponse(true, "Lấy danh sách user thành công", users.Select(ToUserResponse)));
    }

    private async Task<AuthResponse> BuildAuthResponseAsync(IDictionary<string, object?> userRow, string auditAction)
    {
        var user = ToUserResponse(userRow);
        var token = tokenService.GenerateToken(new CurrentUserContext(user.Id, user.Email, user.Role));
        await auditLog.WriteAsync(auditAction, user.Id, "user", user.Id.ToString(), new { user.Email, user.AuthProvider }, HttpContext.RequestAborted);
        return new AuthResponse(user, token);
    }

    private async Task<IDictionary<string, object?>?> UpsertExternalUserAsync(ExternalUserInfo externalUser)
    {
        var byProvider = await db.QuerySingleAsync("sp_Users_GetByProvider",
            new StoredProcedureParameter("AuthProvider", externalUser.Provider),
            new StoredProcedureParameter("ProviderUserId", externalUser.ProviderUserId));

        if (byProvider is not null)
        {
            return await db.QuerySingleAsync("sp_Users_Update",
                new StoredProcedureParameter("Id", byProvider.GetInt("Id")),
                new StoredProcedureParameter("Username", null),
                new StoredProcedureParameter("Email", externalUser.Email),
                new StoredProcedureParameter("Password", null),
                new StoredProcedureParameter("FullName", externalUser.FullName),
                new StoredProcedureParameter("Role", null),
                new StoredProcedureParameter("IsActive", null),
                new StoredProcedureParameter("PhoneNumber", null),
                new StoredProcedureParameter("AuthProvider", externalUser.Provider),
                new StoredProcedureParameter("ProviderUserId", externalUser.ProviderUserId),
                new StoredProcedureParameter("AvatarUrl", externalUser.AvatarUrl),
                new StoredProcedureParameter("PhoneVerifiedAt", null));
        }

        var byEmail = await db.QuerySingleAsync("sp_Users_GetByEmail", new StoredProcedureParameter("Email", externalUser.Email));
        if (byEmail is not null)
        {
            return await db.QuerySingleAsync("sp_Users_Update",
                new StoredProcedureParameter("Id", byEmail.GetInt("Id")),
                new StoredProcedureParameter("Username", null),
                new StoredProcedureParameter("Email", externalUser.Email),
                new StoredProcedureParameter("Password", null),
                new StoredProcedureParameter("FullName", externalUser.FullName),
                new StoredProcedureParameter("Role", null),
                new StoredProcedureParameter("IsActive", null),
                new StoredProcedureParameter("PhoneNumber", null),
                new StoredProcedureParameter("AuthProvider", externalUser.Provider),
                new StoredProcedureParameter("ProviderUserId", externalUser.ProviderUserId),
                new StoredProcedureParameter("AvatarUrl", externalUser.AvatarUrl),
                new StoredProcedureParameter("PhoneVerifiedAt", null));
        }

        var username = await BuildUniqueUsernameAsync(externalUser.FullName, externalUser.Email);
        return await CreateUserAsync(new CreateUserOptions(
            username,
            externalUser.Email,
            passwordHasher.HashPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(16))),
            externalUser.FullName,
            externalUser.Provider,
            externalUser.ProviderUserId,
            null,
            externalUser.AvatarUrl));
    }

    private async Task<IDictionary<string, object?>?> CreateUserAsync(CreateUserOptions options)
        => await db.QuerySingleAsync("sp_Users_Create",
            new StoredProcedureParameter("Username", options.Username),
            new StoredProcedureParameter("Email", options.Email),
            new StoredProcedureParameter("Password", options.PasswordHash),
            new StoredProcedureParameter("FullName", options.FullName),
            new StoredProcedureParameter("Role", "user"),
            new StoredProcedureParameter("IsActive", true),
            new StoredProcedureParameter("PhoneNumber", options.PhoneNumber),
            new StoredProcedureParameter("AuthProvider", options.AuthProvider),
            new StoredProcedureParameter("ProviderUserId", options.ProviderUserId),
            new StoredProcedureParameter("AvatarUrl", options.AvatarUrl),
            new StoredProcedureParameter("PhoneVerifiedAt", options.PhoneVerifiedAt));

    private string BuildFrontendCallbackUrl(string baseUrl, string token, string email)
    {
        var separator = baseUrl.Contains('?') ? "&" : "?";
        return $"{baseUrl}{separator}token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}";
    }

    private static string BuildPhoneEmail(string normalizedPhone)
        => $"phone-{normalizedPhone}@users.local";

    private UserResponse ToUserResponse(IDictionary<string, object?> row) => new(
        row.GetInt("Id"),
        row.GetString("Username") ?? string.Empty,
        row.GetString("Email") ?? string.Empty,
        row.GetString("FullName") ?? string.Empty,
        row.GetString("Role") ?? "user",
        row.GetBool("IsActive"),
        row.GetString("PhoneNumber"),
        row.GetString("AuthProvider") ?? "local",
        row.GetString("AvatarUrl"),
        row.GetDateTime("PhoneVerifiedAt"),
        row.GetDateTime("CreatedAt"),
        row.GetDateTime("UpdatedAt"));

    public sealed record RegisterRequest(string Email, string Password, string? FullName, string? Username);
    public sealed record LoginRequest(string Email, string Password);
    public sealed record GoogleLoginRequest(string Credential);
    public sealed record PhoneOtpRequest(string PhoneNumber, string? FullName);
    public sealed record VerifyPhoneOtpRequest(string PhoneNumber, string Otp);
    public sealed record UpdateProfileRequest(string? FullName, string? Username);
    public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
    public sealed record UserResponse(int Id, string Username, string Email, string FullName, string Role, bool IsActive, string? PhoneNumber, string AuthProvider, string? AvatarUrl, DateTime? PhoneVerifiedAt, DateTime? CreatedAt, DateTime? UpdatedAt);
    public sealed record AuthResponse(UserResponse User, string Token);
    private sealed record CreateUserOptions(string Username, string Email, string PasswordHash, string? FullName, string AuthProvider, string? ProviderUserId, string? PhoneNumber, string? AvatarUrl, DateTime? PhoneVerifiedAt = null);

    private async Task<string> BuildUniqueUsernameAsync(string? requestedUsername, string seed)
    {
        var baseUsername = string.IsNullOrWhiteSpace(requestedUsername)
            ? seed.Split('@')[0]
            : requestedUsername.Trim();

        var normalizedBase = NormalizeUsername(baseUsername);
        if (string.IsNullOrWhiteSpace(normalizedBase))
        {
            normalizedBase = "user";
        }

        var allUsers = await db.QueryAsync("sp_Users_GetAll");
        var existing = allUsers
            .Select(user => user.GetString("Username"))
            .Where(username => !string.IsNullOrWhiteSpace(username))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!existing.Contains(normalizedBase))
        {
            return normalizedBase;
        }

        for (var suffix = 1; suffix < 10_000; suffix++)
        {
            var candidate = $"{normalizedBase}{suffix}";
            if (!existing.Contains(candidate))
            {
                return candidate;
            }
        }

        return $"{normalizedBase}{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
    }

    private static string NormalizeUsername(string username)
        => string.Concat(username.Trim().Where(char.IsLetterOrDigit));
}
