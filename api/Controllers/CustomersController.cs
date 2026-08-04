using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Policy = "AdminOnly")]
public class CustomersController : ControllerBase
{
    [HttpGet]
    public async Task<IResult> GetCustomers([FromServices] CustomerService customerService)
    {
        return Results.Ok(await customerService.GetCustomerAsync());
    }
}
