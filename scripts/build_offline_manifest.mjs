import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function buildOfflineManifest(root) {
  const source = JSON.parse(
    await readFile(resolve(root, "hkele-data/update-manifest.json"), "utf8"),
  );
  const approvals = JSON.parse(
    await readFile(resolve("src/config/offlineDataReleases.json"), "utf8"),
  );
  const appVersion = (await readFile(resolve("src/config/release.ts"), "utf8")).match(
    /APP_VERSION = "([^"]+)"/,
  )[1];
  const files = [];
  const add = async (path, expected) => {
    const bytes = await readFile(resolve(root, path));
    const entry = { path, byteSize: bytes.length, sha256: sha(bytes) };
    if (
      expected &&
      (entry.byteSize !== expected.byteSize || entry.sha256 !== expected.sha256.toLowerCase())
    )
      throw new Error(`Offline source differs from selected release: ${path}`);
    files.push(entry);
  };
  for (const file of source.files) await add(`hkele-data/${file.path}`, file);
  await add("hkele-data/ai_full_projection.json.gz");
  const dataInventory = files
    .map((f) => [f.path, f.byteSize, f.sha256])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const dataInventorySha256 = sha(JSON.stringify(dataInventory));
  const approved = approvals[source.dataVersion];
  if (
    !approved ||
    approved.dataInventorySha256 !== dataInventorySha256 ||
    approved.sourceManifestSha256 !== source.sourceManifestSha256.toLowerCase()
  )
    throw new Error("Offline data is not the explicitly approved release.");
  if (
    sha(await readFile(resolve(root, "hkele-data/manifest.json.gz"))) !==
    approved.sourceManifestSha256
  )
    throw new Error("Static data manifest fingerprint differs.");
  async function addTree(directory) {
    for (const entry of (await readdir(resolve(root, directory), { withFileTypes: true })).sort(
      (a, b) => (a.name < b.name ? -1 : 1),
    )) {
      const path = directory + "/" + entry.name;
      if (entry.isDirectory()) await addTree(path);
      else if (entry.isFile()) await add(path);
    }
  }
  await addTree("ocr");
  await addTree("assets");
  await addTree("_expo");
  for (const path of [
    "index.html",
    "manifest.webmanifest",
    "favicon.ico",
    "pwa-icon-192.png",
    "pwa-icon-512.png",
  ])
    await add(path);
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const manifest = {
    schemaVersion: "hkele-offline/1",
    releaseId: sha(JSON.stringify(files.map((f) => [f.path, f.byteSize, f.sha256]))),
    dataVersion: source.dataVersion,
    appVersion,
    dataApiVersion: source.dataApiVersion,
    sourceManifestSha256: source.sourceManifestSha256,
    dataInventorySha256,
    counts: source.counts,
    byteCount: files.reduce((n, f) => n + f.byteSize, 0),
    files,
  };
  if (manifest.byteCount > 200_000_000)
    throw new Error("Offline bundle exceeds its approved size bound.");
  await writeFile(resolve(root, "offline-package.json"), JSON.stringify(manifest, null, 2) + "\n");
  process.stdout.write(
    `Offline inventory: ${files.length} files, ${manifest.byteCount} bytes; ${manifest.releaseId}\n`,
  );
  return manifest;
}
