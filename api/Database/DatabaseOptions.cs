using System.Text.RegularExpressions;

namespace Api.Database;

public sealed class DatabaseOptions
{
    public required string EdgeTable { get; init; }
    public required string EdgeStatsView { get; init; }
    public required string NodeTable { get; init; }
    public required string InterfaceTable { get; init; }
    public required string PortsTable { get; init; }
    public required string NodePortTable { get; init; }
    public required int SeenCountThreshold { get; init; }

    private static readonly Regex TableRegex = new(
        @"^(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))\.(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))$",
        RegexOptions.Compiled
    );

    public bool IsValid()
    {
        bool EdgeTableValid = TableRegex.IsMatch(EdgeTable);
        Console.WriteLine($"EdgeTable: {EdgeTable}, Valid: {EdgeTableValid}");
        bool EdgeStatsViewValid = TableRegex.IsMatch(EdgeStatsView);
        Console.WriteLine($"EdgeStatsView: {EdgeStatsView}, Valid: {EdgeStatsViewValid}");
        bool NodeTableValid = TableRegex.IsMatch(NodeTable);
        Console.WriteLine($"NodeTable: {NodeTable}, Valid: {NodeTableValid}");
        bool InterfaceTableValid = TableRegex.IsMatch(InterfaceTable);
        Console.WriteLine($"InterfaceTable: {InterfaceTable}, Valid: {InterfaceTableValid}");
        bool PortsTableValid = TableRegex.IsMatch(PortsTable);
        Console.WriteLine($"PortsTable: {PortsTable}, Valid: {PortsTableValid}");
        bool NodePortTableValid = TableRegex.IsMatch(NodePortTable);
        Console.WriteLine($"NodePortTable: {NodePortTable}, Valid: {NodePortTableValid}");
        bool SeenCountThresholdValid = SeenCountThreshold >= 0;
        Console.WriteLine($"SeenCountThreshold: {SeenCountThreshold}, Valid: {SeenCountThresholdValid}");

        return EdgeTableValid && EdgeStatsViewValid && NodeTableValid && InterfaceTableValid && PortsTableValid && NodePortTableValid && SeenCountThresholdValid;
    }
}
