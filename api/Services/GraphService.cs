using Api.Database;
using Api.Models;

public class GraphService
{
    private Db db;
    private readonly ILogger<GraphService> _logger;

    public GraphService(ILogger<GraphService> logger, Db _db)
    {
        _logger = logger;
        db = _db;
    }

    public GraphResponse GetGraph(int customerId = -1)
    {
        return new GraphResponse(
            new List<NodeDto>(),
            new List<EdgeDto>(),
            new List<string>(),
            new List<string>(),
            new GraphCursor(DateTime.UtcNow.ToString("o"), 0, 0)
        );
    }

    public GraphResponse GetGraph(GraphCursor cursor, int customerId = -1)
    {
        return new GraphResponse(
            new List<NodeDto>(),
            new List<EdgeDto>(),
            new List<string>(),
            new List<string>(),
            new GraphCursor(DateTime.UtcNow.ToString("o"), 0, 0)
        );
    }
}
