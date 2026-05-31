using Api.Database;
using Api.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
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
            + "1. EdgeTable and NodeTable must be in the format [schema].[table] or schema.table, where schema and table consist of letters, numbers, or underscores. \n"
            + "2. SeenCountThreshold must be a non-negative integer. \n"
            + "3. A valid connection string named 'DefaultConnection' must be provided in the configuration.\n"
    )
    .ValidateOnStart();

builder.Services.AddScoped<GraphService>();
builder.Services.AddScoped<Db>();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

app.MapGet(
    "/",
    () =>
        Results.Ok(
            new { status = "ok", version = $"v{typeof(Program).Assembly.GetName().Version}" }
        )
);

app.MapGet(
    "/api/health",
    () =>
        Results.Ok(
            new { status = "ok", version = $"v{typeof(Program).Assembly.GetName().Version}" }
        )
);

// Layout:

// /api/graph - returns the full graph snapshot with cursor, use same function but just a zero cursor to get the full snapshot
// /api/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta since the provided cursor
//
// /api/customer/{id}/graph - returns the full graph snapshot for a specific customer with cursor
// /api/customer/{id}/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta for a specific customer since the provided cursor

app.MapGet(
    "/api/graph",
    async (string? lastSeen, long? lastEdgeId, long? lastNodeId, GraphService graphService) =>
    {

        var correct = DateTimeOffset.TryParse(lastSeen, out DateTimeOffset parsedLastSeen);
        if (!correct)
        {
            parsedLastSeen = DateTimeOffset.UnixEpoch;
            app.Logger.LogWarning(
                "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
                lastSeen
            );
        }


        var cursor = new GraphCursor(
            parsedLastSeen,
            lastEdgeId ?? 0,
            lastNodeId ?? 0
        );


        return await graphService.GetGraphAsync(cursor);
    }
);

try
{
    app.Run();
}
catch (OperationCanceledException) { }
