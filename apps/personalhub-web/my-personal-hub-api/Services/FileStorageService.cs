namespace my_personal_hub_api.Services;

public class FileStorageService(IWebHostEnvironment environment, IConfiguration configuration)
{
    public string RootPath { get; } = Path.GetFullPath(Path.Combine(
        environment.ContentRootPath,
        configuration["Storage:RootPath"] ?? "Storage\\Uploads"
    ));

    public void EnsureCreated() => Directory.CreateDirectory(RootPath);

    public async Task<(string StoredName, string RelativeUrl)> SaveAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(file.FileName);
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(RootPath, storedName);

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream, cancellationToken);

        return (storedName, $"/uploads/{storedName}");
    }

    public string GetFullPath(string storedName) => Path.Combine(RootPath, Path.GetFileName(storedName));

    public void DeleteIfExists(string? storedName)
    {
        if (string.IsNullOrWhiteSpace(storedName)) return;
        var fullPath = GetFullPath(Path.GetFileName(storedName));
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }
}
