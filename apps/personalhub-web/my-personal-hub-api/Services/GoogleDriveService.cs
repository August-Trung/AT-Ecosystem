using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;
using Google.Apis.Util.Store;

namespace my_personal_hub_api.Services;

public class GoogleDriveService(IWebHostEnvironment environment, IConfiguration configuration, ILogger<GoogleDriveService> logger)
{
    private static readonly string[] Scopes = [DriveService.Scope.DriveFile];

    private readonly string _credentialsPath = Path.GetFullPath(Path.Combine(
        environment.ContentRootPath,
        configuration["GoogleDrive:CredentialsPath"] ?? "credentials.json"));

    private readonly string _tokenPath = Path.GetFullPath(Path.Combine(
        environment.ContentRootPath,
        configuration["GoogleDrive:TokenPath"] ?? "Storage\\GoogleDriveToken"));

    private readonly string? _folderId = configuration["GoogleDrive:FolderId"]?.Trim();
    private readonly string _applicationName = configuration["GoogleDrive:ApplicationName"] ?? "My Personal Hub";

    public bool IsConfigured => System.IO.File.Exists(_credentialsPath) && !string.IsNullOrWhiteSpace(_folderId);

    public async Task<GoogleDriveStatus> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return new GoogleDriveStatus(false, false, "Google Drive is not configured.");
        }

        if (!Directory.Exists(_tokenPath) || !Directory.EnumerateFiles(_tokenPath, "*", SearchOption.AllDirectories).Any())
        {
            return new GoogleDriveStatus(true, false, "Google Drive is configured but not authorized.");
        }

        try
        {
            using var service = await CreateServiceAsync(cancellationToken);
            var about = service.About.Get();
            about.Fields = "user(displayName,emailAddress)";
            var info = await about.ExecuteAsync(cancellationToken);
            var detail = $"Authorized as {info.User?.DisplayName ?? info.User?.EmailAddress ?? "Google account"}.";
            return new GoogleDriveStatus(true, true, detail);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Unable to validate Google Drive authorization state.");
            return new GoogleDriveStatus(true, false, "Google Drive authorization is invalid or expired.");
        }
    }

    public async Task<GoogleDriveStatus> AuthorizeAsync(CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return new GoogleDriveStatus(false, false, "Missing credentials.json or folderId.");
        }

        using var service = await CreateServiceAsync(cancellationToken);
        var about = service.About.Get();
        about.Fields = "user(displayName,emailAddress)";
        var info = await about.ExecuteAsync(cancellationToken);
        var detail = $"Authorized as {info.User?.DisplayName ?? info.User?.EmailAddress ?? "Google account"}.";
        return new GoogleDriveStatus(true, true, detail);
    }

    public async Task<GoogleDriveUploadResult> UploadAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        using var service = await CreateServiceAsync(cancellationToken);
        await using var stream = file.OpenReadStream();

        var metadata = new Google.Apis.Drive.v3.Data.File
        {
            Name = Path.GetFileName(file.FileName),
            Parents = [ _folderId! ]
        };

        var request = service.Files.Create(metadata, stream, file.ContentType ?? "application/octet-stream");
        request.Fields = "id,name,webViewLink,webContentLink,mimeType,size";
        var progress = await request.UploadAsync(cancellationToken);

        if (progress.Status != UploadStatus.Completed || request.ResponseBody is null)
        {
            throw new InvalidOperationException($"Google Drive upload failed: {progress.Status}");
        }

        await MakeFileReadableAsync(service, request.ResponseBody.Id, cancellationToken);

        return new GoogleDriveUploadResult(
            request.ResponseBody.Id,
            request.ResponseBody.Name ?? Path.GetFileName(file.FileName),
            request.ResponseBody.WebViewLink ?? string.Empty,
            request.ResponseBody.WebContentLink ?? string.Empty,
            request.ResponseBody.Size ?? file.Length,
            request.ResponseBody.MimeType ?? file.ContentType ?? "application/octet-stream");
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> DownloadAsync(string fileId, string fallbackName, CancellationToken cancellationToken = default)
    {
        using var service = await CreateServiceAsync(cancellationToken);
        var metadataRequest = service.Files.Get(fileId);
        metadataRequest.Fields = "id,name,mimeType";
        var metadata = await metadataRequest.ExecuteAsync(cancellationToken);

        var memory = new MemoryStream();
        var downloadRequest = service.Files.Get(fileId);
        await downloadRequest.DownloadAsync(memory, cancellationToken);
        memory.Position = 0;

        return (
            memory,
            metadata.MimeType ?? "application/octet-stream",
            metadata.Name ?? fallbackName);
    }

    public async Task DeleteAsync(string fileId, CancellationToken cancellationToken = default)
    {
        using var service = await CreateServiceAsync(cancellationToken);
        await service.Files.Delete(fileId).ExecuteAsync(cancellationToken);
    }

    private async Task<DriveService> CreateServiceAsync(CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_tokenPath);

        await using var stream = new FileStream(_credentialsPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var secrets = GoogleClientSecrets.FromStream(stream).Secrets;
        var credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
            secrets,
            Scopes,
            "my-personal-hub",
            cancellationToken,
            new FileDataStore(_tokenPath, true));

        return new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = _applicationName
        });
    }

    private static async Task MakeFileReadableAsync(DriveService service, string? fileId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(fileId))
        {
            return;
        }

        var permission = new Google.Apis.Drive.v3.Data.Permission
        {
            Type = "anyone",
            Role = "reader"
        };

        var request = service.Permissions.Create(permission, fileId);
        request.Fields = "id";
        await request.ExecuteAsync(cancellationToken);
    }

    public sealed record GoogleDriveStatus(bool IsConfigured, bool IsAuthorized, string Message);
    public sealed record GoogleDriveUploadResult(string FileId, string Name, string WebViewLink, string DownloadLink, long SizeBytes, string MimeType);
}
