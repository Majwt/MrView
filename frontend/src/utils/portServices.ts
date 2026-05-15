export function isDynamicPort(port: number) {
  return port >= 49152 && port <= 65535;
}

export function getServiceName(port: number): string {
  if (isDynamicPort(port)) return "Dynamic";

  switch (port) {
    case 0: return "Dynamic";
    case 21: return "FTP";
    case 22: return "SSH";
    case 23: return "Telnet";
    case 25: return "SMTP";
    case 53: return "DNS";
    case 80: return "HTTP";
    case 110: return "POP3";
    case 135: return "RPC";
    case 143: return "IMAP";
    case 389: return "LDAP";
    case 443: return "HTTPS";
    case 445: return "SMB";
    case 465: return "SMTPS";
    case 587: return "SMTP-Submission";
    case 636: return "LDAPS";
    case 993: return "IMAPS";
    case 995: return "POP3S";
    case 1433: return "MS-SQL";
    case 1444: return "MS-SQL";
    case 1455: return "MS-SQL";
    case 1466: return "MS-SQL";
    case 1477: return "MS-SQL";
    case 1488: return "MS-SQL";
    case 1984: return "MrBig Agent";
    case 3260: return "iscsi-target";
    case 3306: return "MySQL";
    case 3389: return "RDP";
    case 5022: return "MS-SQL-Listener";
    case 5023: return "MS-SQL-Listener";
    case 5024: return "MS-SQL-Listener";
    case 5025: return "MS-SQL-Listener";
    case 5432: return "PostgreSQL";
    case 5985: return "WinRM-HTTP";
    case 5986: return "WinRM-HTTPS";
    case 8080: return "HTTP-Alt";
    case 8181: return "AxiAnswer";
    case 8403: return "Commvault";
    case 8443: return "HTTPS-Alt";
    case 9000: return "SQL Proxy via LK";
    case 12202: return "Graylog";
    case 24158: return "WMI";
    default: return "Unknown";
  }
}

export const SERVICE_FILTER_OPTIONS = [
  "AxiAnswer",
  "Commvault",
  "DNS",
  "Dynamic",
  "FTP",
  "Graylog",
  "HTTP",
  "HTTP-Alt",
  "HTTPS",
  "HTTPS-Alt",
  "IMAP",
  "IMAPS",
  "iscsi-target",
  "LDAP",
  "LDAPS",
  "MS-SQL",
  "MS-SQL-Listener",
  "MrBig Agent",
  "MySQL",
  "POP3",
  "POP3S",
  "PostgreSQL",
  "RDP",
  "RPC",
  "SMB",
  "SMTP",
  "SMTP-Submission",
  "SMTPS",
  "SQL Proxy via LK",
  "SSH",
  "Telnet",
  "Unknown",
  "WinRM-HTTP",
  "WinRM-HTTPS",
  "WMI",
] as const;
