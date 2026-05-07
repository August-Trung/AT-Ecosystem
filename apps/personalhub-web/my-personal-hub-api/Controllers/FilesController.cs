using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController(
    StoredProcedureExecutor db,
    FileStorageService fileStorage,
    GoogleDriveService googleDrive,
    AuditLogService auditLog,
    IConfiguration configuration) : ControllerBase
{
    private readonly long _maxUploadSizeBytes = configuration.GetValue<long?>("Storage:MaxUploadSizeMb") is long maxMb
        ? maxMb * 1024 * 1024
        : 100L * 1024 * 1024;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] string? type, [FromQuery] string? search)
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

        var rows = await db.QueryAsync("sp_Files_GetAll",
            new StoredProcedureParameter("Category", category),
            new StoredProcedureParameter("Type", type?.Trim()),
            new StoredProcedureParameter("Search", search?.Trim()));

        return Ok(new ApiResponse(true, "Files retrieved successfully", FilterVisibleFiles(rows, currentUser).Select(MapFile)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var row = await db.QuerySingleAsync("sp_Files_GetById", new StoredProcedureParameter("Id", id));
        if (row is null)
        {
            return NotFound(new ApiResponse(false, "File not found"));
        }

        if (!CanReadFile(row, currentUser))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen xem file nay"));
        }

        return Ok(new ApiResponse(true, "File retrieved successfully", MapFile(row)));
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

        var rows = await db.QueryAsync("sp_Files_GetAll",
            new StoredProcedureParameter("Category", category),
            new StoredProcedureParameter("Type", null),
            new StoredProcedureParameter("Search", null));
        return Ok(new ApiResponse(true, $"Files in {category} retrieved successfully", FilterVisibleFiles(rows, currentUser).Select(MapFile)));
    }

    [HttpPost("upload")]
    [EnableRateLimiting("uploads")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(104857600)]
    public async Task<IActionResult> Upload([FromForm] UploadFileRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        if (!InputValidation.IsAllowedFile(request.File, _maxUploadSizeBytes))
        {
            return BadRequest(new ApiResponse(false, $"File khong hop le hoac vuot qua gioi han {_maxUploadSizeBytes / 1024 / 1024} MB"));
        }

        if (!InputValidation.IsAllowedCategory(request.Category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        if (!InputValidation.IsAllowedVisibility(request.Visibility))
        {
            return BadRequest(new ApiResponse(false, "Visibility khong hop le"));
        }

        if (!googleDrive.IsConfigured)
        {
            return StatusCode(503, new ApiResponse(false, "Google Drive chua duoc cau hinh. Hay hoan tat credentials va authorize truoc."));
        }

        try
        {
            var uploaded = await googleDrive.UploadAsync(request.File!, HttpContext.RequestAborted);
            var created = await db.QuerySingleAsync("sp_Files_Create",
                new StoredProcedureParameter("Name", Path.GetFileName(request.File!.FileName)),
                new StoredProcedureParameter("Type", ResolveFileType(request.File.FileName, request.File.ContentType)),
                new StoredProcedureParameter("Size", FormatFileSize(request.File.Length)),
                new StoredProcedureParameter("Category", request.Category!.Trim()),
                new StoredProcedureParameter("Tags", request.Tags.SerializeTags()),
                new StoredProcedureParameter("Url", uploaded.WebViewLink),
                new StoredProcedureParameter("DriveFileId", uploaded.FileId),
                new StoredProcedureParameter("Description", request.Description?.Trim()),
                new StoredProcedureParameter("Visibility", string.IsNullOrWhiteSpace(request.Visibility) ? "private" : request.Visibility.Trim()),
                new StoredProcedureParameter("UserId", currentUser.Id));

            if (created is not null)
            {
                await auditLog.WriteAsync("file.upload", currentUser.Id, "file", created.GetInt("Id").ToString(), new
                {
                    name = Path.GetFileName(request.File.FileName),
                    size = request.File.Length
                }, HttpContext.RequestAborted);
            }

            return StatusCode(201, new ApiResponse(true, "File uploaded successfully", created is null ? null : MapFile(created)));
        }
        catch (Exception exception)
        {
            return StatusCode(500, new ApiResponse(false, $"Google Drive upload failed: {exception.Message}"));
        }
    }

    [HttpGet("google-drive/status")]
    public async Task<IActionResult> GetGoogleDriveStatus()
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var status = await googleDrive.GetStatusAsync(HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "Google Drive status retrieved", new
        {
            isConfigured = status.IsConfigured,
            isAuthorized = status.IsAuthorized,
            message = status.Message
        }));
    }

    [HttpPost("google-drive/authorize")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> AuthorizeGoogleDrive()
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var status = await googleDrive.AuthorizeAsync(HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "Google Drive authorized", new
        {
            isConfigured = status.IsConfigured,
            isAuthorized = status.IsAuthorized,
            message = status.Message
        }));
    }

    [HttpPut("{id:int}")]
    [EnableRateLimiting("writes")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFileRequest request)
    {
        var currentUser = HttpContext.GetCurrentUser();
        if (currentUser is null)
        {
            return Unauthorized(new ApiResponse(false, "Not authorized to access this route"));
        }

        var existing = await db.QuerySingleAsync("sp_Files_GetById", new StoredProcedureParameter("Id", id));
        if (existing is null)
        {
            return NotFound(new ApiResponse(false, "File not found"));
        }

        if (!currentUser.OwnsResource(existing))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen cap nhat file nay"));
        }

        if (!string.IsNullOrWhiteSpace(request.Category) && !InputValidation.IsAllowedCategory(request.Category))
        {
            return BadRequest(new ApiResponse(false, "Category khong hop le"));
        }

        if (!InputValidation.IsAllowedVisibility(request.Visibility))
        {
            return BadRequest(new ApiResponse(false, "Visibility khong hop le"));
        }

        var normalizedName = string.IsNullOrWhiteSpace(request.Name) ? null : Path.GetFileName(request.Name.Trim());
        var updated = await db.QuerySingleAsync("sp_Files_Update",
            new StoredProcedureParameter("Id", id),
            new StoredProcedureParameter("Name", normalizedName),
            new StoredProcedureParameter("Category", request.Category?.Trim()),
            new StoredProcedureParameter("Tags", request.Tags is null ? null : request.Tags.SerializeTags()),
            new StoredProcedureParameter("Description", request.Description?.Trim()),
            new StoredProcedureParameter("Visibility", request.Visibility?.Trim()));

        await auditLog.WriteAsync("file.update", currentUser.Id, "file", id.ToString(), new
        {
            normalizedName,
            request.Category,
            request.Visibility
        }, HttpContext.RequestAborted);

        return Ok(new ApiResponse(true, "File updated successfully", updated is null ? null : MapFile(updated)));
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

        var existing = await db.QuerySingleAsync("sp_Files_GetById", new StoredProcedureParameter("Id", id));
        if (existing is null)
        {
            return NotFound(new ApiResponse(false, "File not found"));
        }

        if (!currentUser.OwnsResource(existing))
        {
            return StatusCode(403, new ApiResponse(false, "Ban khong co quyen xoa file nay"));
        }

        var driveFileId = existing.GetString("DriveFileId");
        var isGoogleDriveFile = IsGoogleDriveFile(existing);
        if (!string.IsNullOrWhiteSpace(driveFileId) && isGoogleDriveFile && googleDrive.IsConfigured)
        {
            await googleDrive.DeleteAsync(driveFileId, HttpContext.RequestAborted);
        }
        else
        {
            fileStorage.DeleteIfExists(driveFileId);
        }

        await db.ExecuteAsync("sp_Files_Delete", new StoredProcedureParameter("Id", id));
        await auditLog.WriteAsync("file.delete", currentUser.Id, "file", id.ToString(), new
        {
            name = existing.GetString("Name")
        }, HttpContext.RequestAborted);
        return Ok(new ApiResponse(true, "File deleted successfully"));
    }

    [HttpGet("download/{id:int}")]
    public async Task<IActionResult> Download(int id)
    {
        var row = await db.QuerySingleAsync("sp_Files_GetById", new StoredProcedureParameter("Id", id));
        if (row is null)
        {
            return NotFound(new ApiResponse(false, "File not found"));
        }

        var currentUser = HttpContext.GetCurrentUser();
        if (!CanReadFile(row, currentUser))
        {
            return NotFound(new ApiResponse(false, "File not found"));
        }

        var storedName = row.GetString("DriveFileId");
        if (string.IsNullOrWhiteSpace(storedName))
        {
            return BadRequest(new ApiResponse(false, "File storage reference is missing"));
        }

        if (IsGoogleDriveFile(row) && googleDrive.IsConfigured)
        {
            var downloaded = await googleDrive.DownloadAsync(storedName, row.GetString("Name") ?? storedName, HttpContext.RequestAborted);

            await auditLog.WriteAsync("file.download", currentUser?.Id, "file", id.ToString(), new
            {
                name = row.GetString("Name")
            }, HttpContext.RequestAborted);

            return File(downloaded.Stream, downloaded.ContentType, downloaded.FileName);
        }

        var fullPath = fileStorage.GetFullPath(storedName);
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound(new ApiResponse(false, "Physical file not found"));
        }

        await auditLog.WriteAsync("file.download", currentUser?.Id, "file", id.ToString(), new
        {
            name = row.GetString("Name")
        }, HttpContext.RequestAborted);

        return PhysicalFile(fullPath, "application/octet-stream", row.GetString("Name") ?? storedName);
    }

    private static IEnumerable<IDictionary<string, object?>> FilterVisibleFiles(IEnumerable<IDictionary<string, object?>> rows, CurrentUserContext currentUser)
        => currentUser.IsAdmin() ? rows : rows.Where(row => CanReadFile(row, currentUser));

    private static bool CanReadFile(IDictionary<string, object?> row, CurrentUserContext? currentUser)
    {
        var visibility = row.GetString("Visibility") ?? "private";
        if (string.Equals(visibility, "public", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return currentUser.OwnsResource(row);
    }

    private static bool IsGoogleDriveFile(IDictionary<string, object?> row)
        => (row.GetString("Url") ?? string.Empty).Contains("drive.google.com", StringComparison.OrdinalIgnoreCase);

    private static object MapFile(IDictionary<string, object?> row) => new
    {
        id = row.GetInt("Id"),
        name = row.GetString("Name"),
        type = row.GetString("Type"),
        size = row.GetString("Size"),
        category = row.GetString("Category"),
        tags = ParseTags(row.GetString("Tags")),
        url = row.GetString("Url"),
        driveFileId = row.GetString("DriveFileId"),
        description = row.GetString("Description"),
        visibility = row.GetString("Visibility"),
        userId = row.GetValue("UserId"),
        createdAt = row.GetDateTime("CreatedAt"),
        updatedAt = row.GetDateTime("UpdatedAt")
    };

    private static string ResolveFileType(string fileName, string? contentType)
    {
        var extension = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        if (contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) == true || extension == "pdf") return "pdf";
        if (contentType?.Contains("word", StringComparison.OrdinalIgnoreCase) == true || new[] { "doc", "docx" }.Contains(extension)) return "word";
        if (contentType?.Contains("excel", StringComparison.OrdinalIgnoreCase) == true || new[] { "xls", "xlsx" }.Contains(extension)) return "excel";
        if (contentType?.Contains("powerpoint", StringComparison.OrdinalIgnoreCase) == true || new[] { "ppt", "pptx" }.Contains(extension)) return "ppt";
        if (contentType?.Contains("image", StringComparison.OrdinalIgnoreCase) == true || new[] { "jpg", "jpeg", "png", "gif", "webp" }.Contains(extension)) return "image";
        if (contentType?.Contains("video", StringComparison.OrdinalIgnoreCase) == true || new[] { "mp4", "avi", "mov", "mkv" }.Contains(extension)) return "video";
        return "other";
    }

    private static string FormatFileSize(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{bytes / 1024d:F1} KB";
        if (bytes < 1024L * 1024 * 1024) return $"{bytes / 1024d / 1024d:F1} MB";
        return $"{bytes / 1024d / 1024d / 1024d:F1} GB";
    }

    private static object ParseTags(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(tags) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    public sealed record UploadFileRequest(IFormFile? File, string? Category, string? Tags, string? Description, string? Visibility);
    public sealed record UpdateFileRequest(string? Name, string? Category, object? Tags, string? Description, string? Visibility);
}
