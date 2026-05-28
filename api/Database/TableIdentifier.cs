namespace Api.Database;

public sealed partial record TableIdentifier(string Schema, string Table)
{
    public static TableIdentifier Parse(string input)
    {
        var match = Config.TableRegex.Match(input);

        if (!match.Success)
        {
            throw new InvalidOperationException($"Invalid table identifier '{input}'.");
        }

        var schema = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;

        var table = match.Groups[3].Success ? match.Groups[3].Value : match.Groups[4].Value;

        return new TableIdentifier(schema, table);
    }

    public static bool TryParse(string input, out TableIdentifier? result)
    {
        var match = Config.TableRegex.Match(input);

        Console.WriteLine($"Trying to parse table identifier from '{input}'.");

        if (!match.Success)
        {
            result = null;
            return false;
        }

        var schema = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;

        var table = match.Groups[3].Success ? match.Groups[3].Value : match.Groups[4].Value;

        result = new TableIdentifier(schema, table);
        return true;
    }

    public override string ToString()
    {
        return $"[{Schema}].[{Table}]";
    }
}
