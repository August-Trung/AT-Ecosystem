using System.Data.Odbc;

namespace my_personal_hub_api.Infrastructure;

public record StoredProcedureParameter(string Name, object? Value);

public class StoredProcedureExecutor(IConfiguration configuration)
{
    private readonly string _connectionString = configuration.GetConnectionString("SqlServer")
        ?? throw new InvalidOperationException("Missing SqlServer connection string.");

    public async Task<List<Dictionary<string, object?>>> QueryAsync(string procedureName, params StoredProcedureParameter[] parameters)
    {
        await using var connection = new OdbcConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = CreateCommand(connection, procedureName, parameters);
        await using var reader = await command.ExecuteReaderAsync();

        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
            }
            rows.Add(row);
        }

        return rows;
    }

    public async Task<Dictionary<string, object?>?> QuerySingleAsync(string procedureName, params StoredProcedureParameter[] parameters)
        => (await QueryAsync(procedureName, parameters)).FirstOrDefault();

    public async Task<int> ExecuteAsync(string procedureName, params StoredProcedureParameter[] parameters)
    {
        await using var connection = new OdbcConnection(_connectionString);
        await connection.OpenAsync();
        await using var command = CreateCommand(connection, procedureName, parameters);
        return await command.ExecuteNonQueryAsync();
    }

    private static OdbcCommand CreateCommand(OdbcConnection connection, string procedureName, IEnumerable<StoredProcedureParameter> parameters)
    {
        var parameterList = parameters.ToList();
        var command = connection.CreateCommand();
        command.CommandText = BuildCommandText(procedureName, parameterList);

        foreach (var parameter in parameterList)
        {
            command.Parameters.AddWithValue(parameter.Name, parameter.Value ?? DBNull.Value);
        }

        return command;
    }

    private static string BuildCommandText(string procedureName, IReadOnlyList<StoredProcedureParameter> parameters)
    {
        if (parameters.Count == 0)
        {
            return $"EXEC {procedureName}";
        }

        var assignments = parameters
            .Select(parameter => $"@{parameter.Name} = ?")
            .ToArray();

        return $"EXEC {procedureName} {string.Join(", ", assignments)}";
    }
}
