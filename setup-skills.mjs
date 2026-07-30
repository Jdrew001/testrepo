#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify, parse } from "jsonc-parser";

const packageName = "@citi-ct0-179716/common-copilot-skills";
const skillLocation = `node_modules/${packageName}/skills`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const packageSkillsDir = path.join(packageRoot, "skills");

const command = process.argv[2] ?? "help";

function getVsCodeAppName() {
  const appNameArgIndex = process.argv.indexOf("--app-name");

  if (appNameArgIndex !== -1 && process.argv[appNameArgIndex + 1]) {
    return process.argv[appNameArgIndex + 1];
  }

  if (process.argv.includes("--insiders")) {
    return process.platform === "darwin" ? "Code - Insiders" : "Code - Insiders";
  }

  return process.env.VSCODE_APP_NAME ?? "Code";
}

function getVsCodeUserSettingsPath() {
  const appName = getVsCodeAppName();

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      appName,
      "User",
      "settings.json"
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      appName,
      "User",
      "settings.json"
    );
  }

  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    appName,
    "User",
    "settings.json"
  );
}

function readSettings(settingsPath) {
