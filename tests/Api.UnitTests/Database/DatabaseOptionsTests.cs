using Api.Database;
using Xunit;

namespace Api.UnitTests.Database;

public class DatabaseOptionsTests
{
    [Fact]
    public void IsValid_ReturnsTrue_ForValidOptions()
    {
        var options = CreateValidOptions();

        Assert.True(options.IsValid());
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenTableIdentifierIsInvalid()
    {
        var options = CreateValidOptions(nodeTable: "invalid-table-name");

        Assert.False(options.IsValid());
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenThresholdIsNegative()
    {
        var options = CreateValidOptions(seenCountThreshold: -1);

        Assert.False(options.IsValid());
    }

    private static DatabaseOptions CreateValidOptions(
        string edgeTable = "dbo.connection_edge",
        string edgeStatsView = "dbo.v_connection_stats",
        string nodeTable = "dbo.managed_node",
        string interfaceTable = "dbo.node_interface",
        string portsTable = "dbo.ports",
        int seenCountThreshold = 0)
    {
        return new DatabaseOptions
        {
            EdgeTable = edgeTable,
            EdgeStatsView = edgeStatsView,
            NodeTable = nodeTable,
            InterfaceTable = interfaceTable,
            PortsTable = portsTable,
            SeenCountThreshold = seenCountThreshold,
        };
    }
}
