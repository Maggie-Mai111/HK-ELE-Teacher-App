export interface WorkbookDownloadRelease {
  dataVersion: string;
  wordOriginsVersion: string;
  workbookVersion: string;
  filename: string;
  assetPath: string;
  byteSize: number;
  sha256: string;
}
export async function verifyWorkbookDownload(
  bytes: Uint8Array<ArrayBuffer>,
  release: WorkbookDownloadRelease,
  currentDataVersion: string,
  hash: (bytes: Uint8Array<ArrayBuffer>) => Promise<string>,
): Promise<void> {
  if (currentDataVersion !== release.dataVersion)
    throw new Error("Update the wordlist before downloading this file.");
  if (
    bytes.length !== release.byteSize ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    (await hash(bytes)) !== release.sha256
  )
    throw new Error("We couldn't download the file. Please try again.");
}
