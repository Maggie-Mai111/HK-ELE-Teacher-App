import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import release from "../config/fullDatabaseWorkbook.json";
import { verifyWorkbookDownload } from "./fullDatabaseWorkbookContract";

export async function downloadFullDatabase(currentDataVersion: string): Promise<void> {
  const response = await fetch(
    `https://maggie-mai111.github.io/HK-ELE-Teacher-App/${release.assetPath}`,
  );
  if (!response.ok) throw new Error("Connect to the internet to download the file.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifyWorkbookDownload(bytes, release, currentDataVersion, async (value) => {
    const result = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, value.buffer));
    return [...result].map((n) => n.toString(16).padStart(2, "0")).join("");
  });
  const file = new File(Paths.cache, release.filename);
  file.create({ overwrite: true });
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "Save full database",
  });
}
