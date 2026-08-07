namespace Api.Models;

public record DashboardMetric(
    string Name,
    double Value,
    string DescriptionHeader,
    string DescriptionBody,
    long? PreviousValue = null,
    double? PercentageChange = null
);
