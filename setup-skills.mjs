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
  if (!fs.existsSync(settingsPath)) {
    return "{}\n";
  }

  return fs.readFileSync(settingsPath, "utf8");
}

function parseSettings(source) {
  return (
    parse(source, undefined, {
      allowTrailingComma: true,
      disallowComments: false
    }) ?? {}
  );
}

function getExistingSkillLocations(settings) {
  const current = settings["chat.agentSkillsLocations"];

  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current;
  }

  return {};
}

function writeSettings(settingsPath, source, updated) {
  if (source === updated) {
    console.log("VS Code settings already configured.");
    return;
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
  }

  fs.writeFileSync(settingsPath, updated);
}

function configure() {
  const settingsPath = getVsCodeUserSettingsPath();
  const source = readSettings(settingsPath);
  const settings = parseSettings(source);
  const existingLocations = getExistingSkillLocations(settings);

  const nextLocations = {
    ...existingLocations,
    [skillLocation]: true
  };

  const formattingOptions = {
    insertSpaces: true,
    tabSize: 2
  };

  let updated = applyEdits(
    source,
    modify(source, ["chat.agentSkillsLocations"], nextLocations, {
      formattingOptions
    })
  );

  updated = applyEdits(
    updated,
    modify(updated, ["chat.useAgentSkills"], true, {
      formattingOptions
    })
  );

  writeSettings(settingsPath, source, updated);

  console.log(`Configured VS Code skill location: ${skillLocation}`);
  console.log("Enabled VS Code setting: chat.useAgentSkills");
  console.log(`Updated settings file: ${settingsPath}`);
  console.log("Reload VS Code, then open Copilot Chat in Agent mode and run /skills.");
}

function listSkills() {
  if (!fs.existsSync(packageSkillsDir)) {
    console.error(`Skills directory not found: ${packageSkillsDir}`);
    process.exit(1);
  }

  const skills = fs
    .readdirSync(packageSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skills.length === 0) {
    console.log("No skills found.");
    return;
  }

  for (const skill of skills) {
    console.log(skill);
  }
}

function doctor() {
  const settingsPath = getVsCodeUserSettingsPath();
  const source = readSettings(settingsPath);
  const settings = parseSettings(source);
  const workspaceSkillPath = path.resolve(process.cwd(), skillLocation);
  const locations = getExistingSkillLocations(settings);

  console.log(`Package: ${packageName}`);
  console.log(`Command package root: ${packageRoot}`);
  console.log(`Packaged skills directory: ${packageSkillsDir}`);
  console.log(`Workspace: ${process.cwd()}`);
  console.log(`Workspace skill path: ${workspaceSkillPath}`);
  console.log(`Workspace skill path exists: ${fs.existsSync(workspaceSkillPath)}`);
  console.log(`VS Code settings file: ${settingsPath}`);
  console.log(`chat.useAgentSkills: ${settings["chat.useAgentSkills"] === true}`);
  console.log(
    `chat.agentSkillsLocations has package path: ${locations[skillLocation] === true}`
  );

  if (fs.existsSync(packageSkillsDir)) {
    console.log("\nPackaged skills:");
    listSkills();
  }
}

function help() {
  console.log(`
Usage:
  setup-skills configure
  setup-skills list
  setup-skills doctor

Options:
  --insiders                 Update VS Code Insiders settings.
  --app-name "Code - OSS"    Update settings for a specific VS Code app name.

Examples:
  npx setup-skills configure
  npx setup-skills doctor
  npx setup-skills configure --insiders
`);
}

if (command === "configure") {
  configure();
} else if (command === "list") {
  listSkills();
} else if (command === "doctor") {
  doctor();
} else {
  help();
}
