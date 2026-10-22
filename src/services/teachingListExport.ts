import { strToU8, zipSync } from "fflate";

import type { TeachingListItem } from "../domain/teachingList";
import { lessonFocusLabel } from "./lessonPlanning";
import { teacherWordListLabel } from "./wordListPresentation";
import { teacherLevelLabel } from "./externalLevelPresentation";

export type ExportFormat = "csv" | "md" | "xlsx";

const columns = [
  "Lesson",
  "Order",
  "Selected words",
  "Teaching plan",
  "Teaching notes",
  "Related words or example",
  "Word family",
  "Added from",
  "Family key",
  "Word list",
  "Overall rank",
  "HK rank",
  "HK band",
  "Earliest observed",
  "External level",
  "Data version",
  "Earlier teaching depth",
  "Saved selection status",
] as const;

const expressionColumns = ["Record type", "Expression ID", "Compound data version"];
const exportColumns = (items: TeachingListItem[]) =>
  items.some((item) => item.recordType === "compound")
    ? [...columns, ...expressionColumns]
    : columns;
function row(
  item: TeachingListItem,
  index: number,
  lessonTitle = "",
  expressions = false,
): Array<string | number> {
  return [
    lessonTitle,
    index + 1,
    item.selectedForms.join(" | "),
    lessonFocusLabel(item.teachingFocus),
    item.notes,
    item.connections,
    item.recordType === "compound" ? "" : item.displayFamily,
    (item.sourceLabels ?? []).join(" | "),
    item.recordType === "compound" ? "" : item.basewordKey,
    item.recordType === "compound" ? "Compound" : teacherWordListLabel(item.derived.set_membership),
    item.derived.overall_frequency_order ?? "",
    item.derived.current_hk_frequency_rank ?? "",
    item.derived.current_hk_frequency_band ?? "",
    item.derived.textbook_first_seen_level ?? "",
    teacherLevelLabel(item.derived.external_level_reference_display) ?? "",
    item.dataVersion,
    item.status,
    item.dataReviewStatus ?? "",
    ...(expressions
      ? [
          item.recordType === "compound" ? "Compound" : "Word family",
          item.expression?.expressionId || "",
          item.expression?.sourceVersion || "",
        ]
      : []),
  ];
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function teachingListToCsv(items: TeachingListItem[], lessonTitle = ""): string {
  return [
    exportColumns(items),
    ...items.map((item, index) =>
      row(
        item,
        index,
        lessonTitle,
        items.some((item) => item.recordType === "compound"),
      ),
    ),
  ]
    .map((values) => values.map(csvCell).join(","))
    .join("\r\n");
}

function markdownCell(value: string | number | undefined): string {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function teachingListToMarkdown(items: TeachingListItem[], lessonTitle = ""): string {
  const headers = [
    "Words",
    "Teaching plan",
    "Teaching notes",
    "Related words or example",
    "Family",
    "Added from",
    "Word list",
    "Earlier teaching depth",
    "Saved selection status",
  ];
  const lines = items.map(
    (item) =>
      `| ${[
        item.selectedForms.join(", "),
        lessonFocusLabel(item.teachingFocus),
        item.notes,
        item.connections,
        item.recordType === "compound" ? "" : item.displayFamily,
        (item.sourceLabels ?? []).join(", "),
        item.recordType === "compound"
          ? `Compound (${item.expression?.expressionId}; ${item.expression?.sourceVersion})`
          : teacherWordListLabel(item.derived.set_membership),
        item.status,
        item.dataReviewStatus ?? "",
      ]
        .map(markdownCell)
        .join(" | ")} |`,
  );
  return [
    "# HK-ELE Teaching list",
    "",
    lessonTitle ? `Lesson: ${markdownCell(lessonTitle)}` : "",
    "Teaching plans are intentions, not student attainment results.",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...lines,
    "",
  ].join("\n");
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

function sheetXml(items: TeachingListItem[], lessonTitle = ""): string {
  const values: Array<ReadonlyArray<string | number>> = [
    exportColumns(items),
    ...items.map((item, index) =>
      row(
        item,
        index,
        lessonTitle,
        items.some((item) => item.recordType === "compound"),
      ),
    ),
  ];
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
  <cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="8" customWidth="1"/><col min="3" max="4" width="24" customWidth="1"/><col min="5" max="6" width="38" customWidth="1"/><col min="7" max="17" width="22" customWidth="1"/></cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="A1:Q${endRow}"/>
</worksheet>`;
}

export function teachingListToXlsx(items: TeachingListItem[], lessonTitle = ""): Uint8Array {
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
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(items, lessonTitle)),
  };
  return zipSync(files, { level: 6 });
}

export function buildTeachingListExport(
  items: TeachingListItem[],
  format: ExportFormat,
  lessonTitle = "",
) {
  const date = new Date().toISOString().slice(0, 10);
  const lessonName = lessonTitle
    .normalize("NFKC")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 70);
  const filename = `HK-ELE-Teaching-List-${lessonName ? `${lessonName}-` : ""}${date}`;
  if (format === "csv") {
    return {
      filename: `${filename}.csv`,
      mimeType: "text/csv;charset=utf-8",
      data: teachingListToCsv(items, lessonTitle),
    };
  }
  if (format === "md") {
    return {
      filename: `${filename}.md`,
      mimeType: "text/markdown;charset=utf-8",
      data: teachingListToMarkdown(items, lessonTitle),
    };
  }
  return {
    filename: `${filename}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: teachingListToXlsx(items, lessonTitle),
  };
}
