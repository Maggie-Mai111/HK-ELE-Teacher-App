import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import type { TeachingListItem } from "../domain/teachingList";
import type { HkeleRepository } from "../domain/hkele";
import { buildTeachingListExport, type ExportFormat } from "./teachingListExport";
import { prepareTeachingExportItems } from "./teachingExportEvidence";

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

export async function exportTeachingList(
  items: TeachingListItem[],
  format: ExportFormat,
  lessonTitle = "",
  repository: HkeleRepository,
): Promise<string> {
  const exportItems = format === "md" ? items : await prepareTeachingExportItems(items, repository);
  const output = buildTeachingListExport(exportItems, format, lessonTitle, true);
  if (Platform.OS === "web") {
    const bytes = toBytes(output.data);
    const blob = new Blob([bytes.slice().buffer], { type: output.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = output.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return output.filename;
  }
  const file = new File(Paths.cache, output.filename);
  const nativeFile = file as unknown as {
    create(options: { overwrite: boolean }): void;
    write(data: Uint8Array): void;
    uri: string;
  };
  nativeFile.create({ overwrite: true });
  nativeFile.write(toBytes(output.data));
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(nativeFile.uri, {
    mimeType: output.mimeType,
    dialogTitle: "Save teaching list",
  });
  return output.filename;
}
