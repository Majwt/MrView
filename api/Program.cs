using Api.Database;
using Api.Models;
using System.Globalization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System
        .Text
        .Json
        .JsonNamingPolicy
        .SnakeCaseLower;
});
builder.Configuration.AddEnvironmentVariables();

builder
    .Services.AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection("Database"))
    .Validate(
        o =>
            o.IsValid()
            && builder.Configuration.GetConnectionString(Config.CONNECTION_STRING_NAME) != null,
        "Invalid database configuration. \nOne of the following conditions is not met: \n"
            + "1. EdgeTable, NodeTable, InterfaceTable, and PortsTable must be in the format [schema].[table] or schema.table, where schema and table consist of letters, numbers, or underscores. \n"
            + "2. SeenCountThreshold must be a non-negative integer. \n"
            + "3. A valid connection string named 'Default' must be provided in the configuration.\n"
    )
    .ValidateOnStart();

builder.Services.AddScoped<GraphService>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<Db>();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddHealthChecks();

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();


app.UseHttpsRedirection();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

app.MapHealthChecks("/api/healthz");
app.MapHealthChecks("/");

// Layout:

// /api/graph - returns the full graph snapshot with cursor, use same function but just a zero cursor to get the full snapshot
// /api/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta since the provided cursor
//
// /api/customer/{id}/graph - returns the full graph snapshot for a specific customer with cursor
// /api/customer/{id}/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta for a specific customer since the provided cursor
//
// /api/customers - All customers in a list with ids and names, so the client can know which customer ids to use for the above endpoints

app.MapGet(
    "/api/graph",
    async (string? lastSeen, long? lastEdgeId, long? lastNodeId, GraphService graphService) =>
    {
        var correct = DateTime.TryParse(
            lastSeen,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out DateTime parsedLastSeen
        );
        if (!correct)
        {
            parsedLastSeen = DateTime.UnixEpoch;
            app.Logger.LogWarning(
                "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
                lastSeen
            );
        }

        var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);

        return await graphService.GetGraphAsync(cursor);
    }
);

app.MapGet("/api/customer/{customerId}/graph", async (int customerId, string? lastSeen, long? lastEdgeId, long? lastNodeId, GraphService graphService) =>
{
    var correct = DateTime.TryParse(
        lastSeen,
        CultureInfo.InvariantCulture,
        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
        out DateTime parsedLastSeen
    );
    if (!correct)
    {
        parsedLastSeen = DateTime.UnixEpoch;
        app.Logger.LogWarning(
            "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
            lastSeen
        );
    }

    var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
    app.Logger.LogInformation(
        "Received request for customer {0} with cursor: lastSeen={1}, lastEdgeId={2}, lastNodeId={3}",
        customerId,
        parsedLastSeen,
        lastEdgeId ?? 0,
        lastNodeId ?? 0
    );

    return await graphService.GetGraphAsync(cursor, customerId);
});

app.MapGet(
    "/api/customers",
    async (CustomerService customerService) => await customerService.GetCustomerAsync()
);

try
{
    app.Run();
}
catch (OperationCanceledException) { }
