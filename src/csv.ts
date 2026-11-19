export type CsvValue = string | number;

export function createCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]) {
  const escape = (value: CsvValue) => `"${String(value).replaceAll('"', '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join(
    "\r\n",
  );
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + createCsv(headers, rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
