using Api.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Api.Database;

public class CustomerReadRepository : ICustomerReadRepository
{
    private readonly string _connectionString;
    private readonly TableIdentifier _nodesTable;

    public CustomerReadRepository(IConfiguration configuration, IOptions<DatabaseOptions> options)
    {
        _connectionString = configuration.GetConnectionString(Config.CONNECTION_STRING_NAME)
            ?? throw new InvalidOperationException("Missing connection string.");

        _nodesTable = TableIdentifier.Parse(options.Value.NodeTable);
    }

    public async Task<Customer[]> getAllCustomersAsync()
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(
            $"""
            SELECT DISTINCT
                group_id,
                group_name
            FROM {_nodesTable}
            WHERE group_id IS NOT NULL
            ORDER BY group_name;
            """,
            connection);

        await using var reader = await command.ExecuteReaderAsync();

        var customers = new List<Customer>();
        var groupIdOrdinal = reader.GetOrdinal("group_id");
        var groupNameOrdinal = reader.GetOrdinal("group_name");

        while (await reader.ReadAsync())
        {
            var groupId = reader.GetInt32(groupIdOrdinal);
            var groupName = reader.IsDBNull(groupNameOrdinal)
                ? $"Group {groupId}"
                : reader.GetString(groupNameOrdinal);

            customers.Add(new Customer(Name: groupName, CmdbCiId: string.Empty, Id: groupId));
        }

        return customers.ToArray();
    }

    public async Task<Customer?> GetCustomerByIdAsync(int customerId)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(
            $"""
            SELECT TOP (1)
                group_id,
                group_name
            FROM {_nodesTable}
            WHERE group_id = @customerId;
            """,
            connection);
        command.Parameters.AddWithValue("@customerId", customerId);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        var groupId = reader.GetInt32(reader.GetOrdinal("group_id"));
        var groupNameOrdinal = reader.GetOrdinal("group_name");
        var groupName = reader.IsDBNull(groupNameOrdinal)
            ? $"Group {groupId}"
            : reader.GetString(groupNameOrdinal);

        return new Customer(Name: groupName, CmdbCiId: string.Empty, Id: groupId);
    }
}
