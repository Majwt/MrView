using System.Text.RegularExpressions;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

public static partial class Config
{
    public const string CONNECTION_STRING_NAME = "Default";

    [GeneratedRegex(
        @"^(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))\.(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))$"
    )]
    public static partial Regex TableRegex { get; }

    public const string datetimeFormat = "yyyy-MM-dd HH:mm:ss.fffffff";
}


public sealed class SqlDateTimeJsonConverter : JsonConverter<DateTime>
{

    public override DateTime Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        var value = reader.GetString();

        if (string.IsNullOrWhiteSpace(value))
            return default;

        return DateTime.ParseExact(
            value,
            Config.datetimeFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None);
    }

    public override void Write(
        Utf8JsonWriter writer,
        DateTime value,
        JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString(Config.datetimeFormat, CultureInfo.InvariantCulture));
    }
}
