import { strToU8, zipSync } from "fflate";

import type { TeachingListItem } from "../domain/teachingList";

export type ExportFormat = "csv" | "md" | "xlsx";

const columns = [
  "Order",
  "Family key",
  "Family",
  "Selected forms",
  "Status",
  "Notes",
  "Connections",
  "Set",
  "Overall rank",
  "HK rank",
  "HK band",
  "Earliest observed",
  "External level",
  "Data version",
] as const;

function row(item: TeachingListItem, index: number): Array<string | number> {
  return [
    index + 1,
    item.basewordKey,
    item.displayFamily,
    item.selectedForms.join(" | "),
    item.status,
    item.notes,
    item.connections,
    item.derived.set_membership ?? "",
    item.derived.overall_frequency_order ?? "",
    item.derived.current_hk_frequency_rank ?? "",
    item.derived.current_hk_frequency_band ?? "",
    item.derived.textbook_first_seen_level ?? "",
    item.derived.external_level_reference_display ?? "",
    item.dataVersion,
  ];
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function teachingListToCsv(items: TeachingListItem[]): string {
  return [columns, ...items.map(row)].map((values) => values.map(csvCell).join(",")).join("\r\n");
}

function markdownCell(value: string | number | undefined): string {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function teachingListToMarkdown(items: TeachingListItem[]): string {
  const selected = [
    "Family",
    "Selected forms",
    "Status",
    "Notes",
    "Connections",
    "Set",
    "Overall rank",
  ];
  const header = `| ${selected.join(" | ")} |`;
  const separator = `| ${selected.map(() => "---").join(" | ")} |`;
  const lines = items.map((item) => {
    const values = row(item, item.customOrder);
    const chosen = [values[2], values[3], values[4], values[5], values[6], values[7], values[8]];
    return `| ${chosen.map(markdownCell).join(" | ")} |`;
  });
  return ["# HK-ELE Teaching list", "", header, separator, ...lines, ""].join("\n");
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function sheetXml(items: TeachingListItem[]): string {
  const values: Array<ReadonlyArray<string | number>> = [columns, ...items.map(row)];
  const rows = values
    .map((valuesRow, rowIndex) => {
      const cells = valuesRow
        .map((value, columnIndex) => {
          const address = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === "number") return `<c r="${address}"><v>${value}</v></c>`;
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${address}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
    })
    .join("");
  const endRow = Math.max(1, values.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="4" width="22" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/><col min="6" max="7" width="30" customWidth="1"/><col min="8" max="14" width="18" customWidth="1"/></cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="A1:N${endRow}"/>
</worksheet>`;
}

export function teachingListToXlsx(items: TeachingListItem[]): Uint8Array {
  const now = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    "docProps/app.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>HK-ELE Teacher</Application></Properties>`,
    ),
    "docProps/core.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>HK-ELE Teaching list</dc:title><dc:creator>HK-ELE Teacher</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(now)}</dcterms:created></cp:coreProperties>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Teaching list" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B45"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(items)),
  };
  return zipSync(files, { level: 6 });
}

export function buildTeachingListExport(items: TeachingListItem[], format: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return {
      filename: `HK-ELE-Teaching-List-${date}.csv`,
      mimeType: "text/csv;charset=utf-8",
      data: teachingListToCsv(items),
    };
  }
  if (format === "md") {
    return {
      filename: `HK-ELE-Teaching-List-${date}.md`,
      mimeType: "text/markdown;charset=utf-8",
      data: teachingListToMarkdown(items),
    };
  }
  return {
    filename: `HK-ELE-Teaching-List-${date}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: teachingListToXlsx(items),
  };
}
