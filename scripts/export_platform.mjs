import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [platform, outputDirectory] = process.argv.slice(2);
if (!new Set(["web", "android", "ios"]).has(platform) || !outputDirectory) {
  throw new Error("Usage: node scripts/export_platform.mjs <web|android|ios> <output-directory>");
}

const environment = {
  ...process.env,
  EXPO_PUBLIC_FOLDER: platform === "web" ? "public" : "public-native",
};
const expoCli = resolve(process.cwd(), "node_modules", "expo", "bin", "cli");
const result = spawnSync(
  process.execPath,
  [expoCli, "export", "--platform", platform, "--output-dir", outputDirectory],
  { env: environment, stdio: "inherit" },
);
if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) {
  process.exitCode = result.status ?? 1;
} else if (platform === "web") {
  const finalizer = resolve(process.cwd(), "scripts", "finalize_web_deployment.mjs");
  const finalized = spawnSync(process.execPath, [finalizer, outputDirectory], {
    env: environment,
    stdio: "inherit",
  });
  if (finalized.error) throw finalized.error;
  process.exitCode = finalized.status ?? 1;
} else {
  process.exitCode = 0;
}
