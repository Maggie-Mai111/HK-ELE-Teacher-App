import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Compare only the explicitly registered inventory; never select data by date or folder number.
const [webDataPath] = process.argv.slice(2);
if (!webDataPath)
  throw new Error("Usage: node scripts/verify_web_data_parity.mjs <explicit-web-data-directory>");
const appData = resolve("public/hkele-data");
const webData = resolve(webDataPath);
const source = JSON.parse(await readFile(resolve(appData, "update-manifest.json"), "utf8"));
const approved = JSON.parse(await readFile(resolve("src/config/offlineDataReleases.json"), "utf8"))[
  source.dataVersion
];
if (!approved)
  throw new Error("Select and approve the data release before checking product parity.");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inventory = [...new Set([...source.files.map((f) => f.path), "ai_full_projection.json.gz"])];
for (const path of inventory) {
  const a = await readFile(resolve(appData, path));
  const b = await readFile(resolve(webData, path));
  const expected = source.files.find((f) => f.path === path);
  if (
    sha(a) !== sha(b) ||
    (expected && (a.length !== expected.byteSize || sha(a) !== expected.sha256.toLowerCase()))
  )
    throw new Error(`Web/App data differs: ${path}`);
}
process.stdout.write(
  JSON.stringify({
    status: "PASS",
    dataVersion: source.dataVersion,
    files: inventory.length,
    webData,
    appData,
    counts: source.counts,
  }) + "\n",
);
