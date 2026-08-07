using System.Text.RegularExpressions;

public static partial class Config
{
    public const string CONNECTION_STRING_NAME = "Default";

    [GeneratedRegex(
        @"^(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))\.(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))$"
    )]
    public static partial Regex TableRegex { get; }

}


