using Api.Models;

namespace Api.Database;

public interface ICustomerReadRepository
{
    Task<Customer[]> getAllCustomersAsync();
}
