/** RFC 4180 CSV cell, with spreadsheet formula-injection protection (= + - @ tab CR → prefixed with '). */
export function csvCell(value: unknown): string {
  let s = Array.isArray(value) ? value.join("; ") : value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (e.g. Murang'a, em dashes) correctly.
  return String.fromCharCode(0xfeff) + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
