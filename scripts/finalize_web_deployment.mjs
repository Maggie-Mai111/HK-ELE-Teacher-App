import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const [outputDirectory] = process.argv.slice(2);
if (!outputDirectory)
  throw new Error("Usage: node scripts/finalize_web_deployment.mjs <output-directory>");

const root = resolve(process.cwd(), outputDirectory);
const indexPath = resolve(root, "index.html");
let html = await readFile(indexPath, "utf8");

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

const head = [
  '<meta name="theme-color" content="#0E6550">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<link rel="manifest" href="/HK-ELE-Teacher-App/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/HK-ELE-Teacher-App/pwa-icon-192.png">',
].join("");
const registration = `<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/HK-ELE-Teacher-App/sw.js",{scope:"/HK-ELE-Teacher-App/"}).catch(function(error){console.error("Service worker registration failed",error);});});}</script>`;

if (!html.includes('rel="manifest"')) html = html.replace("</head>", `${head}</head>`);
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover">',
);
if (!html.includes('id="hkele-safe-area"')) {
  html = html.replace(
    "</head>",
    '<style id="hkele-safe-area">html{-webkit-text-size-adjust:100%}html,body,#root{box-sizing:border-box;min-width:0}body{padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)}</style></head>',
  );
}
if (!html.includes('serviceWorker.register("/HK-ELE-Teacher-App/sw.js"')) {
  html = html.replace("</body>", `${registration}</body>`);
}

const wrongRootReference = html.match(
  /(?:href|src)=["']\/(?!HK-ELE-Teacher-App(?:\/|["']))[^"']*/g,
);
if (wrongRootReference?.length) {
  throw new Error(
    `Web export still contains root-only references: ${wrongRootReference.join(", ")}`,
  );
}
if (!html.includes("/HK-ELE-Teacher-App/_expo/")) {
  throw new Error("Expo bundle assets were not exported beneath /HK-ELE-Teacher-App/.");
}

await writeFile(indexPath, html, "utf8");
await writeFile(resolve(root, "404.html"), html, "utf8");
await writeFile(resolve(root, ".nojekyll"), "", "utf8");

const allFiles = await filesBelow(root);
const toUrl = (path) => `/HK-ELE-Teacher-App/${relative(root, path).split(sep).join("/")}`;
const compactAssets = allFiles
  .filter((path) =>
    relative(root, path)
      .split(sep)
      .join("/")
      .match(/^assets\/data\/releases\/2026-09-14-package67-v1\/reference\/.+\.gz$/),
  )
  .map(toUrl)
  .sort();
const buildAssets = allFiles
  .filter((path) =>
    relative(root, path)
      .split(sep)
      .join("/")
      .match(/^_expo\/static\/js\/web\/.+\.js$/),
  )
  .map(toUrl)
  .sort();
if (compactAssets.length !== 3 || buildAssets.length < 1) {
  throw new Error(
    `Unexpected offline asset inventory: compact=${compactAssets.length}, build=${buildAssets.length}`,
  );
}
const fingerprint = createHash("sha256")
  .update(JSON.stringify({ compactAssets, buildAssets }))
  .digest("hex")
  .slice(0, 16);
const serviceWorkerPath = resolve(root, "sw.js");
let serviceWorker = await readFile(serviceWorkerPath, "utf8");
serviceWorker = serviceWorker
  .replace("__PACKAGE85_CACHE_VERSION__", `package85-${fingerprint}`)
  .replace("__PACKAGE85_COMPACT_DATA_ASSETS__", JSON.stringify(compactAssets, null, 2))
  .replace("__PACKAGE85_BUILD_ASSETS__", JSON.stringify(buildAssets, null, 2));
if (serviceWorker.includes("__PACKAGE85_")) throw new Error("Service worker placeholders remain.");
await writeFile(serviceWorkerPath, serviceWorker, "utf8");
process.stdout.write("GitHub Pages /HK-ELE-Teacher-App/ finalization PASS\n");
