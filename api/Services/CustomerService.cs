using Api.Database;
using Api.Models;

public class CustomerService
{
    private readonly ICustomerReadRepository _customerReadRepository;
    private readonly ILogger<CustomerService> _logger;

    public CustomerService(ILogger<CustomerService> logger, ICustomerReadRepository customerReadRepository)
    {
        _logger = logger;
        _customerReadRepository = customerReadRepository;
    }


    public async Task<IEnumerable<Customer>> GetCustomerAsync()
    {
        var customers = await _customerReadRepository.getAllCustomersAsync();
        return customers.Select(c => new Customer(c.Name, c.CmdbCiId, c.Id)).ToArray();
    }

    public Task<Customer?> GetCustomerByIdAsync(int customerId)
    {
        return _customerReadRepository.GetCustomerByIdAsync(customerId);
    }

}
