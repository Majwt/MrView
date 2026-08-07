using Api.Database;
using Xunit;

namespace Api.UnitTests.Database;

public class TableIdentifierTests
{
    [Fact]
    public void Parse_HandlesBracketedIdentifier()
    {
        var result = TableIdentifier.Parse("[dbo].[connection_edge]");

        Assert.Equal("dbo", result.Schema);
        Assert.Equal("connection_edge", result.Table);
        Assert.Equal("[dbo].[connection_edge]", result.ToString());
    }

    [Fact]
    public void Parse_HandlesUnbracketedIdentifier()
    {
        var result = TableIdentifier.Parse("dbo.connection_edge");

        Assert.Equal("dbo", result.Schema);
        Assert.Equal("connection_edge", result.Table);
    }

    [Fact]
    public void Parse_ThrowsOnInvalidIdentifier()
    {
        Assert.Throws<InvalidOperationException>(() => TableIdentifier.Parse("connection_edge"));
    }

    [Fact]
    public void TryParse_ReturnsTrueAndIdentifier_ForValidInput()
    {
        var ok = TableIdentifier.TryParse("dbo.connection_edge", out var result);

        Assert.True(ok);
        Assert.NotNull(result);
        Assert.Equal("dbo", result!.Schema);
        Assert.Equal("connection_edge", result.Table);
    }

    [Fact]
    public void TryParse_ReturnsFalseAndNull_ForInvalidInput()
    {
        var ok = TableIdentifier.TryParse("bad-value", out var result);

        Assert.False(ok);
        Assert.Null(result);
    }
}
