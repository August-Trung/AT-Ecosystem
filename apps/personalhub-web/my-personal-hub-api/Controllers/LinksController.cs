using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Controllers;

[ApiController]
[Route("api/links")]
public class LinksController(
    IConfiguration configuration,
    StoredProcedureExecutor db,
    AuditLogService auditLog) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] string? search, [FromQuery] int? page, [FromQuery] int? limit)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (!string.IsNullOrWhiteSpace(category) && !InputValidation.IsAllowedCategory(category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        var rows = await db.QueryAsync("sp_Links_GetAll",
            new StoredProcedureParameter("Category", category),
            new StoredProcedureParameter("Search", search?.Trim()));

        var data = FilterVisibleLinks(rows, currentUser).Select(MapLink).ToList();

        if (page is > 0 && limit is > 0)
        {
            var paged = data.Skip((page.Value - 1) * limit.Value).Take(limit.Value).ToList();
            return Ok(new ApiResponse(true, "Links retrieved successfully", paged, new
            {
                page,
                limit,
                total = data.Count,
                totalPages = (int)Math.Ceiling(data.Count / (double)limit.Value)
            }));
        }

        return Ok(new ApiResponse(true, "Links retrieved successfully", data));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var row = await db.QuerySingleAsync("sp_Links_GetById", new StoredProcedureParameter("Id", id));
        if (row is null)
        {
            return NotFound(new ApiResponse(false, "Link not found"));
        }

        if (!CanReadLink(row, currentUser))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen xem link nay"));
        }

        return Ok(new ApiResponse(true, "Link retrieved successfully", MapLink(row)));
    }

    [HttpGet("category/{category}")]
    public async Task<IActionResult> GetByCategory(string category)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (!InputValidation.IsAllowedCategory(category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        var rows = await db.QueryAsync("sp_Links_GetAll",
            new StoredProcedureParameter("Category", category),
            new StoredProcedureParameter("Search", null));

        return Ok(new ApiResponse(true, $"Links in {category} retrieved successfully", FilterVisibleLinks(rows, currentUser).Select(MapLink)));
    }

    [HttpGet("check-slug/{slug}")]
    public async Task<IActionResult> CheckSlug(string slug)
    {
        if (HttpContext.GetCurrentUser() is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var normalized = slug.Trim().ToLowerInvariant();
        if (!IsSlugValid(normalized))
        {
            return BadRequest(new ApiResponse(false, "Slug khong hop le"));
        }

        var byCustom = await db.QuerySingleAsync("sp_Links_GetByCustomSlug", new StoredProcedureParameter("CustomSlug", normalized));
        var byShort = await db.QuerySingleAsync("sp_Links_GetByShortUrl", new StoredProcedureParameter("ShortUrl", BuildShortUrl(normalized)));
        return Ok(new ApiResponse(true, "Slug availability checked", new { slug = normalized, available = byCustom is null && byShort is null }));
    }

    [HttpPost]
    [EnableRateLimiting("writes")]
    public async Task<IActionResult> Create([FromBody] LinkRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.OriginalUrl) || string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest(new ApiResponse(false, "Title, originalUrl va category la bat buoc"));
        }

        if (!InputValidation.IsAllowedRedirectUrl(request.OriginalUrl))
        {
            return BadRequest(new ApiResponse(false, "Original URL khong hop le"));
        }

        if (!InputValidation.IsAllowedCategory(request.Category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        if (!InputValidation.IsAllowedVisibility(request.Visibility))
        {
            return BadRequest(new ApiResponse(false, "Visibility khong hop le"));
        }

        var slug = string.IsNullOrWhiteSpace(request.CustomSlug)
            ? await GenerateUniqueSlugAsync()
            : request.CustomSlug.Trim().ToLowerInvariant();
        if (!IsSlugValid(slug))
        {
            return BadRequest(new ApiResponse(false, "Custom slug khong hop le"));
        }

        var byCustom = await db.QuerySingleAsync("sp_Links_GetByCustomSlug", new StoredProcedureParameter("CustomSlug", slug));
        var byShort = await db.QuerySingleAsync("sp_Links_GetByShortUrl", new StoredProcedureParameter("ShortUrl", BuildShortUrl(slug)));
        if (byCustom is not null || byShort is not null)
        {
            return BadRequest(new ApiResponse(false, "Short URL already exists"));
        }

        var created = await db.QuerySingleAsync("sp_Links_Create",
            new StoredProcedureParameter("Title", request.Title.Trim()),
            new StoredProcedureParameter("ShortUrl", BuildShortUrl(slug)),
            new StoredProcedureParameter("OriginalUrl", request.OriginalUrl.Trim()),
            new StoredProcedureParameter("CustomSlug", slug),
            new StoredProcedureParameter("Category", request.Category.Trim()),
            new StoredProcedureParameter("Tags", request.Tags.SerializeTags()),
            new StoredProcedureParameter("Description", request.Description?.Trim()),
            new StoredProcedureParameter("Visibility", string.IsNullOrWhiteSpace(request.Visibility) ? "public" : request.Visibility.Trim()),
            new StoredProcedureParameter("UserId", currentUser.Id));

        if (created is not null)
        {
            await auditLog.WriteAsync("link.create", currentUser.Id, "link", created.GetInt("Id").ToString(), new
            {
                title = request.Title.Trim(),
                slug
            }, HttpContext.RequestAborted);
        }

        return StatusCode(201, new ApiResponse(true, "Link created successfully", created is null ? null : MapLink(created)));
    }

    [HttpPut("{id:int}")]
    [EnableRateLimiting("writes")]
    public async Task<IActionResult> Update(int id, [FromBody] LinkRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var existing = await db.QuerySingleAsync("sp_Links_GetById", new StoredProcedureParameter("Id", id));
        if (existing is null)
        {
            return NotFound(new ApiResponse(false, "Link not found"));
        }

        if (!currentUser.OwnsResource(existing))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen cap nhat link nay"));
        }

        if (!string.IsNullOrWhiteSpace(request.OriginalUrl) && !InputValidation.IsAllowedRedirectUrl(request.OriginalUrl))
        {
            return BadRequest(new ApiResponse(false, "Original URL khong hop le"));
        }

        if (!string.IsNullOrWhiteSpace(request.Category) && !InputValidation.IsAllowedCategory(request.Category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        if (!InputValidation.IsAllowedVisibility(request.Visibility))
        {
            return BadRequest(new ApiResponse(false, "Visibility khong hop le"));
        }

        var requestedShortUrl = request.ShortUrl?.Trim();
        var existingShortUrl = existing.GetString("ShortUrl");
        if (!string.IsNullOrWhiteSpace(requestedShortUrl) &&
            !string.Equals(requestedShortUrl, existingShortUrl, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse(false, "Khong ho tro doi short URL sau khi da tao"));
        }

        var updated = await db.QuerySingleAsync("sp_Links_Update",
            new StoredProcedureParameter("Id", id),
            new StoredProcedureParameter("Title", request.Title?.Trim()),
            new StoredProcedureParameter("ShortUrl", requestedShortUrl),
            new StoredProcedureParameter("OriginalUrl", request.OriginalUrl?.Trim()),
            new StoredProcedureParameter("Category", request.Category?.Trim()),
            new StoredProcedureParameter("Tags", request.Tags is null ? null : request.Tags.SerializeTags()),
            new StoredProcedureParameter("Description", request.Description?.Trim()),
            new StoredProcedureParameter("Visibility", request.Visibility?.Trim()));

        await auditLog.WriteAsync("link.update", currentUser.Id, "link", id.ToString(), new
        {
            request.Title,
            request.Category,
            request.Visibility
        }, HttpContext.RequestAborted);

        return Ok(new ApiResponse(true, "Link updated successfully", updated is null ? null : MapLink(updated)));
    }

    [HttpDelete("{id:int}")]
    [EnableRateLimiting("writes")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var existing = await db.QuerySingleAsync("sp_Links_GetById", new StoredProcedureParameter("Id", id));
        if (existing is null)
        {
            return NotFound(new ApiResponse(false, "Link not found"));
        }

        if (!currentUser.OwnsResource(existing))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen xoa link nay"));
        }

        await db.ExecuteAsync("sp_Links_Delete", new StoredProcedureParameter("Id", id));
        await auditLog.WriteAsync("link.delete", currentUser.Id, "link", id.ToString(), new
        {
            title = existing.GetString("Title")
        }, HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "Link deleted successfully"));
    }

    [HttpGet("redirect/{slug}")]
    public async Task<IActionResult> RedirectToOriginal(string slug)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var row = await db.QuerySingleAsync("sp_Links_GetByCustomSlug", new StoredProcedureParameter("CustomSlug", normalized))
            ?? await db.QuerySingleAsync("sp_Links_GetByShortUrl", new StoredProcedureParameter("ShortUrl", BuildShortUrl(normalized)));

        if (row is null)
        {
            return NotFound("Link not found");
        }

        var currentUser = HttpContext.GetCurrentUser();
        if (!CanReadLink(row, currentUser))
        {
            return NotFound("Link not found");
        }

        await db.ExecuteAsync("sp_Links_IncrementVisits", new StoredProcedureParameter("Id", row.GetInt("Id")));
        return Redirect(row.GetString("OriginalUrl") ?? "/");
    }

    private string BuildShortUrl(string slug) => $"{configuration["ShortUrl:Domain"] ?? "myhub.me"}/{slug}";

    private static bool IsSlugValid(string slug)
        => !string.IsNullOrWhiteSpace(slug) && slug.Length is >= 3 and <= 50 && System.Text.RegularExpressions.Regex.IsMatch(slug, "^[a-z0-9-]+$");

    private async Task<string> GenerateUniqueSlugAsync()
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var slug = Guid.NewGuid().ToString("N")[..6].ToLowerInvariant();
            var byCustom = await db.QuerySingleAsync("sp_Links_GetByCustomSlug", new StoredProcedureParameter("CustomSlug", slug));
            var byShort = await db.QuerySingleAsync("sp_Links_GetByShortUrl", new StoredProcedureParameter("ShortUrl", BuildShortUrl(slug)));

            if (byCustom is null && byShort is null)
            {
                return slug;
            }
        }

        throw new InvalidOperationException("Unable to generate a unique slug");
    }

    private static IEnumerable<IDictionary<string, object?>> FilterVisibleLinks(IEnumerable<IDictionary<string, object?>> rows, CurrentUserContext currentUser)
        => currentUser.IsAdmin() ? rows : rows.Where(row => CanReadLink(row, currentUser));

    private static bool CanReadLink(IDictionary<string, object?> row, CurrentUserContext? currentUser)
    {
        var visibility = row.GetString("Visibility") ?? "public";
        if (string.Equals(visibility, "public", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return currentUser.OwnsResource(row);
    }

    private static object MapLink(IDictionary<string, object?> row) => new
    {
        id = row.GetInt("Id"),
        title = row.GetString("Title"),
        shortUrl = row.GetString("ShortUrl"),
        originalUrl = row.GetString("OriginalUrl"),
        customSlug = row.GetString("CustomSlug"),
        category = row.GetString("Category"),
        tags = ParseTags(row.GetString("Tags")),
        description = row.GetString("Description"),
        visibility = row.GetString("Visibility"),
        visits = row.GetInt("Visits"),
        userId = row.GetValue("UserId"),
        createdAt = row.GetDateTime("CreatedAt"),
        updatedAt = row.GetDateTime("UpdatedAt")
    };

    private static object ParseTags(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(tags) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    public sealed record LinkRequest(string? Title, string? OriginalUrl, string? ShortUrl, string? CustomSlug, string? Category, object? Tags, string? Description, string? Visibility);
}
