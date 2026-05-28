using System.Text.RegularExpressions;

namespace Api.Database;

public sealed class DatabaseOptions
{
    public required string EdgeTable { get; init; }
    public required string NodeTable { get; init; }
    public required int SeenCountThreshold { get; init; }

    private static readonly Regex TableRegex = new(
        @"^(?:\[([A-Za-z0-9]+)\]|([A-Za-z0-9]+))\.(?:\[([A-Za-z0-9]+)\]|([A-Za-z0-9]+))$",
        RegexOptions.Compiled
    );

    public bool IsValid()
    {
        return TableIdentifier.TryParse(EdgeTable, out _)
            && TableIdentifier.TryParse(NodeTable, out _)
            && SeenCountThreshold >= 0;
    }
}
