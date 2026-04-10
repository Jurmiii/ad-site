import * as XLSX from "xlsx";

type ExportColumn<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
};

type ExportOptions<T extends Record<string, unknown>> = {
  sheetName?: string;
  fileName: string;
  columns: Array<ExportColumn<T>>;
  rows: T[];
};

export function exportTableToXlsx<T extends Record<string, unknown>>({
  sheetName = "Sheet1",
  fileName,
  columns,
  rows,
}: ExportOptions<T>) {
  const normalizedRows = rows.map((row) => {
    const record: Record<string, unknown> = {};

    for (const column of columns) {
      record[column.label] = row[column.key];
    }

    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
