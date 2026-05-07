using Microsoft.Extensions.Diagnostics.HealthChecks;
using my_personal_hub_api.Services;

namespace my_personal_hub_api.Infrastructure;

public class FileStorageHealthCheck(FileStorageService fileStorage) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            fileStorage.EnsureCreated();
            var probePath = Path.Combine(fileStorage.RootPath, $".health-{Guid.NewGuid():N}.tmp");
            File.WriteAllText(probePath, DateTimeOffset.UtcNow.ToString("O"));
            File.Delete(probePath);

            return Task.FromResult(HealthCheckResult.Healthy("File storage is writable."));
        }
        catch (Exception exception)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("File storage is unavailable.", exception));
        }
    }
}
