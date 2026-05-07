using System.ComponentModel.DataAnnotations;

namespace my_personal_hub_api.Infrastructure;

public static class InputValidation
{
    private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "IT Support",
        "Tester",
        "Web",
        "Media"
    };

    private static readonly HashSet<string> AllowedVisibility = new(StringComparer.OrdinalIgnoreCase)
    {
        "public",
        "private"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".avi", ".mov", ".mkv",
        ".zip", ".rar", ".7z", ".csv", ".json"
    };

    private static readonly EmailAddressAttribute EmailValidator = new();

    public static bool IsValidEmail(string? email)
        => !string.IsNullOrWhiteSpace(email) && EmailValidator.IsValid(email.Trim());

    public static bool IsStrongEnoughPassword(string? password, int minimumLength)
        => !string.IsNullOrWhiteSpace(password) && password.Trim().Length >= minimumLength;

    public static bool IsAllowedCategory(string? category)
        => !string.IsNullOrWhiteSpace(category) && AllowedCategories.Contains(category.Trim());

    public static bool IsAllowedVisibility(string? visibility)
        => string.IsNullOrWhiteSpace(visibility) || AllowedVisibility.Contains(visibility.Trim());

    public static bool IsAllowedRedirectUrl(string? url)
        => Uri.TryCreate(url, UriKind.Absolute, out var parsed)
           && (parsed.Scheme == Uri.UriSchemeHttp || parsed.Scheme == Uri.UriSchemeHttps);

    public static bool IsValidPhoneNumber(string? phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return false;
        }

        var normalized = NormalizePhoneNumber(phoneNumber);
        return normalized.Length is >= 10 and <= 15 && normalized.All(char.IsDigit);
    }

    public static string NormalizePhoneNumber(string phoneNumber)
        => new(phoneNumber.Where(char.IsDigit).ToArray());

    public static bool IsAllowedFile(IFormFile? file, long maxUploadSizeBytes)
    {
        if (file is null || file.Length <= 0 || file.Length > maxUploadSizeBytes)
        {
            return false;
        }

        var extension = Path.GetExtension(file.FileName);
        return !string.IsNullOrWhiteSpace(extension) && AllowedExtensions.Contains(extension);
    }
}
