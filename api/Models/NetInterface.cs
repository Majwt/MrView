namespace Api.Models;

public sealed record NetInterface(string adapter, string ip, string mac, string subnet);
