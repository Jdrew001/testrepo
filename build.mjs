#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const requiredPaths = [
  "skills",
  "bin/your-org-copilot-skills.mjs",
  "README.md"
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function copyIfExists(from, to) {
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { recursive: true });
  }
}

for (const requiredPath of requiredPaths) {
  if (!fs.existsSync(path.join(root, requiredPath))) {
    fail(`Missing required path: ${requiredPath}`);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

copyIfExists(path.join(root, "skills"), path.join(dist, "skills"));
copyIfExists(path.join(root, "bin"), path.join(dist, "bin"));
copyIfExists(path.join(root, "README.md"), path.join(dist, "README.md"));
copyIfExists(path.join(root, "plugin.json"), path.join(dist, "plugin.json"));

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

const distPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  description: rootPackageJson.description,
  type: rootPackageJson.type,
  bin: rootPackageJson.bin,
  dependencies: rootPackageJson.dependencies ?? {},
  publishConfig: rootPackageJson.publishConfig,
  license: rootPackageJson.license ?? "UNLICENSED"
};

fs.writeFileSync(
  path.join(dist, "package.json"),
  `${JSON.stringify(distPackageJson, null, 2)}\n`
);

const binPath = path.join(dist, "bin", "your-org-copilot-skills.mjs");
fs.chmodSync(binPath, 0o755);

console.log("Built publishable package in dist/");
