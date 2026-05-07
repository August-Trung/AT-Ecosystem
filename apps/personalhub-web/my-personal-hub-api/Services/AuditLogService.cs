using System.Text.Json;

namespace my_personal_hub_api.Services;

public class AuditLogService(IWebHostEnvironment environment, ILogger<AuditLogService> logger)
{
    private readonly string _rootPath = Path.Combine(environment.ContentRootPath, "Logs", "Audit");

    public async Task WriteAsync(string action, int? userId, string? entityType, string? entityId, object? details, CancellationToken cancellationToken = default)
    {
        try
        {
            Directory.CreateDirectory(_rootPath);
            var filePath = Path.Combine(_rootPath, $"audit-{DateTime.UtcNow:yyyyMMdd}.log");

            var entry = new
            {
                timestamp = DateTimeOffset.UtcNow,
                action,
                userId,
                entityType,
                entityId,
                details
            };

            await File.AppendAllTextAsync(filePath, JsonSerializer.Serialize(entry) + Environment.NewLine, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Unable to persist audit log for {Action}", action);
        }
    }
}
