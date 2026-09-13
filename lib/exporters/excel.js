import ExcelJS from "exceljs";

function formatValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
  return value;
}

export async function buildExcelBuffer({ sheetName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.max(c.header.length + 2, 14),
  }));

  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const values = {};
    for (const c of columns) {
      values[c.key] = formatValue(row[c.key]);
    }
    sheet.addRow(values);
  }

  return workbook.xlsx.writeBuffer();
}
