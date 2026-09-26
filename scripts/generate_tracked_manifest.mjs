import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const outputName = "TRACKED_FILE_MANIFEST.csv";
const excludedRoots = new Set([
  ".git",
  ".expo",
  ".test-dist",
  ".wrangler",
  "android",
  "dist",
  "dist-android",
  "dist-fixture",
  "dist-ios",
  "ios",
  "node_modules",
  "reports",
]);

async function inventory(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === root && excludedRoots.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await inventory(path)));
    else if (entry.isFile() && relative(root, path).split(sep).join("/") !== outputName)
      files.push(path);
  }
  return files;
}

const files = (await inventory(root)).sort((left, right) =>
  relative(root, left).localeCompare(relative(root, right), "en"),
);
const entries = await Promise.all(
  files.map(async (path) => {
    const bytes = await readFile(path);
    return {
      path: relative(root, path).split(sep).join("/"),
      bytes: (await stat(path)).size,
      sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    };
  }),
);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const csv = [
  ["path", "bytes", "sha256"],
  ...entries.map((entry) => [entry.path, entry.bytes, entry.sha256]),
]
  .map((row) => row.map(quote).join(","))
  .join("\n");
await writeFile(resolve(root, outputName), `${csv}\n`, "utf8");

function parseManifest(text) {
  const rows = new Map();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const match = line.match(/^"((?:[^"]|"")*)","(\d+)","([A-F0-9]{64})"$/u);
    if (!match) throw new Error(`Invalid manifest row: ${line.slice(0, 120)}`);
    rows.set(match[1].replaceAll('""', '"'), { bytes: Number(match[2]), sha256: match[3] });
  }
  return rows;
}

const source = parseManifest(
  await readFile(resolve(root, "PACKAGE83_SOURCE_TRACKED_FILE_MANIFEST.csv"), "utf8"),
);
const current = new Map(entries.map((entry) => [entry.path, entry]));
const added = [...current.keys()].filter((path) => !source.has(path));
const removed = [...source.keys()].filter((path) => !current.has(path));
const changed = [...current.keys()].filter(
  (path) => source.has(path) && source.get(path).sha256 !== current.get(path).sha256,
);
const unchanged = [...current.keys()].filter(
  (path) => source.has(path) && source.get(path).sha256 === current.get(path).sha256,
);
process.stdout.write(
  `${JSON.stringify(
    {
      entries: entries.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
      addedPaths: added,
      removedPaths: removed,
      changedPaths: changed,
    },
    null,
    2,
  )}\n`,
);
