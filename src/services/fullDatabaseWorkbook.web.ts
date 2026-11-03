import release from "../config/fullDatabaseWorkbook.json";
import { verifyWorkbookDownload } from "./fullDatabaseWorkbookContract";

export async function downloadFullDatabase(currentDataVersion: string): Promise<void> {
  const response = await fetch(`/HK-ELE-Teacher-App/${release.assetPath}`, {
    cache: "force-cache",
  });
  if (!response.ok) throw new Error("Connect to the internet to download the file.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifyWorkbookDownload(bytes, release, currentDataVersion, async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", value.buffer);
    return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
  });
  const url = URL.createObjectURL(
    new Blob([bytes.buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = release.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
