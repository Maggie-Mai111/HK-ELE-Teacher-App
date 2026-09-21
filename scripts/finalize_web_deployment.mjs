import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [outputDirectory] = process.argv.slice(2);
if (!outputDirectory)
  throw new Error("Usage: node scripts/finalize_web_deployment.mjs <output-directory>");

const root = resolve(process.cwd(), outputDirectory);
const indexPath = resolve(root, "index.html");
let html = await readFile(indexPath, "utf8");

const head = [
  '<meta name="theme-color" content="#0E6550">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<link rel="manifest" href="/HK-ELE-Teacher-App/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/HK-ELE-Teacher-App/pwa-icon-192.png">',
].join("");
const registration = `<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/HK-ELE-Teacher-App/sw.js",{scope:"/HK-ELE-Teacher-App/"}).catch(function(error){console.error("Service worker registration failed",error);});});}</script>`;

if (!html.includes('rel="manifest"')) html = html.replace("</head>", `${head}</head>`);
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
process.stdout.write("GitHub Pages /HK-ELE-Teacher-App/ finalization PASS\n");
