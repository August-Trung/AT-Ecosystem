using System.Security.Cryptography;

namespace my_personal_hub_api.Services;

public class PhoneOtpService(IConfiguration configuration, IWebHostEnvironment environment)
{
    private readonly int _otpLength = configuration.GetValue<int?>("AuthProviders:Phone:OtpLength") ?? 6;
    private readonly int _otpExpiryMinutes = configuration.GetValue<int?>("AuthProviders:Phone:OtpExpiryMinutes") ?? 5;
    private readonly bool _exposeOtp = configuration.GetValue<bool?>("AuthProviders:Phone:ExposeOtpInDevelopment") ?? true;

    public int OtpLength => _otpLength;

    public string GenerateOtp()
    {
        var max = (int)Math.Pow(10, _otpLength);
        var value = RandomNumberGenerator.GetInt32(0, max);
        return value.ToString($"D{_otpLength}");
    }

    public DateTime GetExpiryUtc() => DateTime.UtcNow.AddMinutes(_otpExpiryMinutes);

    public object BuildDeliveryPayload(string otp)
        => environment.IsDevelopment() && _exposeOtp
            ? new { delivered = false, otp, channel = "development-preview" }
            : new { delivered = false, channel = "not-configured" };
}
