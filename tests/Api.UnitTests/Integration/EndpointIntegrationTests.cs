using System.Net;
using System.Net.Http.Headers;
using Xunit;

namespace Api.UnitTests.Integration;

public sealed class EndpointIntegrationTests : IClassFixture<ApiWebApplicationFactory>
{
    private readonly ApiWebApplicationFactory _factory;

    public EndpointIntegrationTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GraphEndpoint_WithAdminToken_ReturnsOk_NotUnsupportedMediaType()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "admin");

        var response = await client.GetAsync("/api/graph?excludeIsolated=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"upsert_nodes\"", body);
        Assert.Contains("\"cursor\"", body);
    }

    [Fact]
    public async Task GraphEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        using var client = CreateHttpsClient();

        var response = await client.GetAsync("/api/graph");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GraphEndpoint_CustomerWithoutCustomerId_ReturnsForbidden()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-no-id");

        var response = await client.GetAsync("/api/graph");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DashboardStats_WithAdminToken_ReturnsGlobalStats()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "admin");

        var response = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"total_edges\":100", body);
    }

    [Fact]
    public async Task DashboardStats_WithCustomerToken_UsesScopedStats()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-7");

        var response = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"total_edges\":7", body);
    }

    [Fact]
    public async Task CustomerDashboardStats_WithAdminToken_ReturnsScopedStats()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "admin");

        var response = await client.GetAsync("/api/customer/7/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"total_edges\":7", body);
    }

    [Fact]
    public async Task CustomerDashboardStats_WithCustomerToken_ReturnsForbidden()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-7");

        var response = await client.GetAsync("/api/customer/7/dashboard/stats");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CustomerDashboardStats_WithoutToken_ReturnsUnauthorized()
    {
        using var client = CreateHttpsClient();

        var response = await client.GetAsync("/api/customer/7/dashboard/stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CurrentCustomer_WithCustomerToken_ReturnsOwnCustomer()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-7");

        var response = await client.GetAsync("/api/customers/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"name\":\"Axians\"", body);
        Assert.Contains("\"id\":7", body);
        Assert.DoesNotContain("Contoso", body);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("customer-no-id")]
    public async Task CurrentCustomer_WithoutCustomerClaim_ReturnsForbidden(string token)
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/customers/me");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CurrentCustomer_WithUnknownCustomerClaim_ReturnsNotFound()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-999");

        var response = await client.GetAsync("/api/customers/me");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Customers_WithCustomerToken_ReturnsForbidden()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "customer-7");

        var response = await client.GetAsync("/api/customers");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AuthRefresh_WithoutCookie_ReturnsUnauthorized()
    {
        using var client = CreateHttpsClient();

        var response = await client.PostAsync("/api/auth/refresh", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AuthLogout_WithToken_ReturnsOk()
    {
        using var client = CreateHttpsClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "admin");

        var response = await client.PostAsync("/api/auth/logout", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private HttpClient CreateHttpsClient()
    {
        return _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
        });
    }
}
