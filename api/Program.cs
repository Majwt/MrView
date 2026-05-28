using Api.Database;

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
    .Validate(o => o.IsValid(), "Invalid database configuration.")
    .ValidateOnStart();

builder.Services.AddScoped<GraphService>();
builder.Services.AddScoped<Db>();

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
// /api/graph?since_last_seen={timestamp}&since_row_id={id} - returns the graph delta since the provided cursor
//
// /api/customer/{id}/graph - returns the full graph snapshot for a specific customer with cursor
// /api/customer/{id}/graph?since_last_seen={timestamp}&since_row_id={id} - returns the graph delta for a specific customer since the provided cursor

app.MapGet("/api/graph", async (GraphService graphService) => { });

try
{
    app.Run();
}
catch (OperationCanceledException) { }
