namespace Api.Models;

public sealed record NetInterface(string adapter, string? ipv4, string? subnetv4, string? ipv6, string? subnetv6, string mac, string? status = null);
