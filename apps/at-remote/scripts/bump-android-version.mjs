import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(root, "package.json");
const gradlePath = path.join(root, "android", "app", "build.gradle");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const item = process.argv[index];
  if (!item.startsWith("--")) continue;
  const key = item.slice(2);
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[++index] : "true";
  args.set(key, value);
}

const version = String(args.get("version") || "").trim();
const code = Number(args.get("code") || 0);
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run version:android -- --version 1.0.1 --code 2");
  process.exit(1);
}
if (!Number.isInteger(code) || code < 1) {
  console.error("--code must be a positive integer.");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

let gradle = fs.readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
fs.writeFileSync(gradlePath, gradle);

console.log(`AT Remote Android version set to ${version} (${code}).`);
