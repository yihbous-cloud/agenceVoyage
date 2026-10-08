import ExcelJS from "exceljs";

function formatValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
  return value;
}

// infoLines : lignes d'information optionnelles (nom du programme, dates,
// aéroports...) affichées avant le tableau — voir la liste d'hébergement
// dans CLAUDE.md. Par défaut (aucune ligne), le comportement est identique à
// avant : la ligne d'en-tête des colonnes reste la première ligne de la
// feuille pour les listes existantes (voyageurs, visa, compagnie aérienne).
export async function buildExcelBuffer({ sheetName, columns, rows, infoLines = [] }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = Math.max(c.header.length + 2, 14);
  });

  for (const line of infoLines) {
    sheet.addRow([line]);
  }
  if (infoLines.length > 0) {
    sheet.addRow([]);
  }

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow(columns.map((c) => formatValue(row[c.key])));
  }

  return workbook.xlsx.writeBuffer();
}
