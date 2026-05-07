using System.Data.Odbc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace my_personal_hub_api.Infrastructure;

public class SqlServerHealthCheck(IConfiguration configuration) : IHealthCheck
{
    private readonly string _connectionString = configuration.GetConnectionString("SqlServer")
        ?? throw new InvalidOperationException("Missing SqlServer connection string.");

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new OdbcConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);

            return HealthCheckResult.Healthy("SQL Server is reachable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("SQL Server is unavailable.", exception);
        }
    }
}
