using Api.Database;
using Api.Models;

public class CustomerService
{
    private Db db;
    private readonly ILogger<CustomerService> _logger;

    public CustomerService(ILogger<CustomerService> logger, Db _db)
    {
        _logger = logger;
        db = _db;
    }


    public async Task<IEnumerable<Customer>> GetCustomerAsync()
    {
        var customers = await db.getAllCustomersAsync();
        return customers.Select(c => new Customer(c.Name, c.CmdbCiId, c.Id)).ToArray();
    }


}
