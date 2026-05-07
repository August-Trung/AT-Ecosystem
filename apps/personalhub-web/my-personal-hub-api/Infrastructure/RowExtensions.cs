using System.Globalization;
using System.Text.Json;

namespace my_personal_hub_api.Infrastructure;

public static class RowExtensions
{
    public static string? GetString(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) && value is not null ? Convert.ToString(value, CultureInfo.InvariantCulture) : null;

    public static int GetInt(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) && value is not null ? Convert.ToInt32(value, CultureInfo.InvariantCulture) : 0;

    public static int? GetNullableInt(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) && value is not null ? Convert.ToInt32(value, CultureInfo.InvariantCulture) : null;

    public static bool GetBool(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) && value is not null && Convert.ToBoolean(value, CultureInfo.InvariantCulture);

    public static DateTime? GetDateTime(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) && value is not null ? Convert.ToDateTime(value, CultureInfo.InvariantCulture) : null;

    public static object? GetValue(this IDictionary<string, object?> row, string key)
        => row.TryGetValue(key, out var value) ? value : null;

    public static string SerializeTags(this object? tags)
    {
        if (tags is null) return JsonSerializer.Serialize(Array.Empty<string>());
        if (tags is string raw)
        {
            var trimmed = raw.Trim();
            if (trimmed.StartsWith("[")) return trimmed;
            var values = trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return JsonSerializer.Serialize(values);
        }

        return JsonSerializer.Serialize(tags);
    }
}
