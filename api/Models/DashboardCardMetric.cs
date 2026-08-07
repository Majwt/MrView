namespace Api.Models;

public record DashboardCardMetric(
    string Id,
    int DisplayOrder,
    string Name,
    double Value,
    string DescriptionHeader,
    string DescriptionBody,
    long? PreviousValue = null,
    double? PercentageChange = null
);
