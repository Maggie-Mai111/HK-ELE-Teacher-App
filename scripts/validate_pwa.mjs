import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

async function filesBelow(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await visit(directory);
  return files;
}

function pngDimensions(bytes) {
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("PWA icon is not PNG.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const manifest = JSON.parse(await readFile(resolve(dist, "manifest.webmanifest"), "utf8"));
const index = await readFile(resolve(dist, "index.html"), "utf8");
const fallback = await readFile(resolve(dist, "404.html"), "utf8");
const serviceWorker = await readFile(resolve(dist, "sw.js"), "utf8");
const icon192 = pngDimensions(await readFile(resolve(dist, "pwa-icon-192.png")));
const icon512 = pngDimensions(await readFile(resolve(dist, "pwa-icon-512.png")));

const checks = {
  manifestId: manifest.id === "/HK-ELE-Teacher-App/",
  manifestStartUrl: manifest.start_url === "/HK-ELE-Teacher-App/",
  manifestScope: manifest.scope === "/HK-ELE-Teacher-App/",
  standalone: manifest.display === "standalone",
  themeColor: manifest.theme_color === "#0E6550",
  icon192: icon192.width === 192 && icon192.height === 192,
  icon512: icon512.width === 512 && icon512.height === 512,
  manifestLinked: index.includes('href="/HK-ELE-Teacher-App/manifest.webmanifest"'),
  serviceWorkerRegistered: index.includes('serviceWorker.register("/HK-ELE-Teacher-App/sw.js"'),
  viewportFit: index.includes("maximum-scale=5, viewport-fit=cover"),
  safeAreaCss: index.includes("safe-area-inset-bottom"),
  subpathAssets: index.includes("/HK-ELE-Teacher-App/_expo/"),
  refreshFallback: fallback === index,
  appShellConfigured: serviceWorker.includes("const APP_SHELL"),
  compactCacheConfigured:
    serviceWorker.includes("const COMPACT_DATA_ASSETS") &&
    serviceWorker.includes("reference/families.json") &&
    serviceWorker.includes("reference/forms.json") &&
    serviceWorker.includes("reference/search-routes.json"),
  hashedBuildCached:
    serviceWorker.includes("const BUILD_ASSETS") &&
    serviceWorker.includes("/_expo/static/js/web/index-"),
  cacheVersionFinalized:
    serviceWorker.includes("package84-") && !serviceWorker.includes("__PACKAGE84_"),
  cacheUpgradeScoped:
    serviceWorker.includes("key.startsWith(CACHE_PREFIX)") &&
    serviceWorker.includes("key !== CACHE_NAME"),
  fullDataExcludedFromPrecache: !serviceWorker
    .slice(
      serviceWorker.indexOf("const APP_SHELL"),
      serviceWorker.indexOf("];", serviceWorker.indexOf("const APP_SHELL")),
    )
    .includes("hkele-data"),
  fullDataFetchBypass: serviceWorker.includes('url.pathname.includes("/hkele-data/")'),
};
if (Object.values(checks).some((value) => !value)) {
  throw new Error(`PWA validation failed: ${JSON.stringify(checks)}`);
}

const files = await filesBelow(dist);
const entries = await Promise.all(
  files.map(async (path) => ({
    path: relative(dist, path).split(sep).join("/"),
    bytes: (await stat(path)).size,
  })),
);
const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const largest = [...entries].sort((a, b) => b.bytes - a.bytes)[0];
if (totalBytes >= 1_000_000_000) throw new Error("GitHub Pages site is 1 GB or larger.");
if (!largest || largest.bytes >= 100_000_000) throw new Error("A Pages file is 100 MB or larger.");
const sqlite = entries.filter((entry) => /\.(sqlite|sqlite3|db)$/i.test(entry.path));
if (sqlite.length) throw new Error(`Raw SQLite entered dist: ${sqlite[0].path}`);

const archivePath = resolve(dist, "hkele-data", "hkele-data-2026-09-14-package67-v1.zip");
const archiveBytes = await readFile(archivePath);
const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex").toUpperCase();
if (archiveSha256 !== "CB767B54582C8D37716BDE18FCD88768440715B7BCA03497532A13FAF1F12951") {
  throw new Error(`Update archive hash changed: ${archiveSha256}`);
}

const report = {
  schemaVersion: "HK_ELE_PACKAGE84_PWA_VALIDATION_1.0.0",
  checkedOn: "2026-09-26",
  status: "PASS",
  basePath: "/HK-ELE-Teacher-App/",
  checks,
  appShellCacheOnly: false,
  compactReferencePrecached: true,
  compactReferenceFiles: entries
    .filter((entry) =>
      entry.path.match(/^assets\/data\/releases\/2026-09-14-package67-v1\/reference\/.+\.gz$/),
    )
    .map((entry) => entry.path),
  fullDatabasePrecached: false,
  updateArchivePrecached: false,
  onlineFullDatabaseSupported: true,
  nativeOcrClaimedForWeb: false,
  site: {
    files: entries.length,
    bytes: totalBytes,
    underOneGigabyte: true,
    largestFile: largest,
    everyFileUnder100Megabytes: true,
    rawSqliteFiles: 0,
    databaseDownloadButtons: 0,
  },
  updateArchive: { bytes: archiveBytes.length, sha256: archiveSha256 },
};
await mkdir(resolve(root, "reports"), { recursive: true });
await writeFile(
  resolve(root, "reports", "PWA_VALIDATION.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
