using Microsoft.AspNetCore.Mvc;
using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;

namespace my_personal_hub_api.Controllers;

[ApiController]
[Route("api/statistics")]
public class StatisticsController(StoredProcedureExecutor db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetOverview()
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var row = await db.QuerySingleAsync("sp_Statistics_GetOverview");
        var totalStorage = await GetTotalStorageAsync();
        if (row is null)
        {
            return Ok(new ApiResponse(true, "Statistics retrieved successfully", new
            {
                totalLinks = 0,
                totalFiles = 0,
                totalVisits = 0,
                totalStorage
            }));
        }

        return Ok(new ApiResponse(true, "Statistics retrieved successfully", new
        {
            totalLinks = row.GetInt("TotalLinks"),
            totalFiles = row.GetInt("TotalFiles"),
            totalVisits = row.GetInt("TotalVisits"),
            totalStorage
        }));
    }

    [HttpGet("links/category")]
    public async Task<IActionResult> GetLinkStatsByCategory()
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var rows = await db.QueryAsync("sp_Links_GetStatsByCategory");
        return Ok(new ApiResponse(true, "Link statistics retrieved successfully", rows.Select(row => new
        {
            category = row.GetString("Category"),
            count = row.GetInt("Count"),
            totalVisits = row.GetInt("TotalVisits")
        })));
    }

    [HttpGet("files/category")]
    public async Task<IActionResult> GetFileStatsByCategory()
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var rows = await db.QueryAsync("sp_Files_GetStatsByCategory");
        return Ok(new ApiResponse(true, "File statistics retrieved successfully", rows.Select(row => new
        {
            category = row.GetString("Category"),
            count = row.GetInt("Count"),
            type = row.GetString("Type")
        })));
    }

    [HttpGet("links/top")]
    public async Task<IActionResult> GetTopLinks([FromQuery] int limit = 10)
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        limit = Math.Clamp(limit, 1, 100);
        var rows = await db.QueryAsync("sp_Links_GetTop", new StoredProcedureParameter("Limit", limit));
        return Ok(new ApiResponse(true, "Top links retrieved successfully", rows.Select(row => new
        {
            id = row.GetInt("Id"),
            title = row.GetString("Title"),
            shortUrl = row.GetString("ShortUrl"),
            visits = row.GetInt("Visits"),
            category = row.GetString("Category"),
            createdAt = row.GetDateTime("CreatedAt")
        })));
    }

    [HttpGet("activities/recent")]
    public async Task<IActionResult> GetRecentActivities([FromQuery] int limit = 20)
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        limit = Math.Clamp(limit, 1, 100);
        var rows = await db.QueryAsync("sp_Statistics_GetRecentActivities", new StoredProcedureParameter("Limit", limit));
        return Ok(new ApiResponse(true, "Recent activities retrieved successfully", rows.Select(row => new
        {
            id = row.GetInt("Id"),
            title = row.GetString("Title"),
            type = row.GetString("Type"),
            createdAt = row.GetDateTime("CreatedAt")
        })));
    }

    private async Task<object> GetTotalStorageAsync()
    {
        var files = await db.QueryAsync("sp_Files_GetAll",
            new StoredProcedureParameter("Category", null),
            new StoredProcedureParameter("Type", null),
            new StoredProcedureParameter("Search", null));

        var totalBytes = files.Sum(file => ParseSizeToBytes(file.GetString("Size")));
        return FormatStorage(totalBytes);
    }

    private static long ParseSizeToBytes(string? size)
    {
        if (string.IsNullOrWhiteSpace(size))
        {
            return 0;
        }

        var match = System.Text.RegularExpressions.Regex.Match(
            size.Trim().ToUpperInvariant(),
            @"([\d.,]+)\s*(B|KB|MB|GB)");

        if (!match.Success)
        {
            return 0;
        }

        var value = double.Parse(match.Groups[1].Value.Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
        var multiplier = match.Groups[2].Value switch
        {
            "GB" => 1024d * 1024d * 1024d,
            "MB" => 1024d * 1024d,
            "KB" => 1024d,
            _ => 1d
        };

        return (long)(value * multiplier);
    }

    private static object FormatStorage(long totalBytes)
    {
        if (totalBytes <= 0)
        {
            return new { value = 0, unit = "MB", display = "0 MB", bytes = 0L };
        }

        var units = new[]
        {
            new { Unit = "GB", Value = totalBytes / (1024d * 1024d * 1024d) },
            new { Unit = "MB", Value = totalBytes / (1024d * 1024d) },
            new { Unit = "KB", Value = totalBytes / 1024d },
            new { Unit = "B", Value = (double)totalBytes }
        };

        var selected = units.First(item => item.Value >= 1 || item.Unit == "B");
        var rounded = Math.Round(selected.Value, 2);
        return new
        {
            value = rounded,
            unit = selected.Unit,
            display = $"{rounded} {selected.Unit}",
            bytes = totalBytes
        };
    }
}
