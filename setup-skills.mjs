#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyEdits, modify, parse } from "jsonc-parser";

const command = process.argv[2] ?? "help";
const skillPath = "node_modules/@your-org/copilot-skills/skills";

function getVsCodeUserSettingsPath() {
  const appName = process.env.VSCODE_APP_NAME ?? "Code";

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName, "User", "settings.json");
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), appName, "User", "settings.json");
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), appName, "User", "settings.json");
}

function configure() {
  const settingsPath = getVsCodeUserSettingsPath();

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  const existing = fs.existsSync(settingsPath)
    ? fs.readFileSync(settingsPath, "utf8")
    : "{}\n";

  const parsed = parse(existing, undefined, {
    allowTrailingComma: true,
    disallowComments: false
  }) ?? {};

  const current = parsed["chat.agentSkillsLocations"];
  const locations = current && typeof current === "object" && !Array.isArray(current)
    ? current
    : {};

  if (locations[skillPath] === true) {
    console.log(`Already configured: ${skillPath}`);
    return;
  }

  const nextLocations = {
    ...locations,
    [skillPath]: true
  };

  const edits = modify(
    existing,
    ["chat.agentSkillsLocations"],
    nextLocations,
    {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2
      }
    }
  );

  const updated = applyEdits(existing, edits);

  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
  }

  fs.writeFileSync(settingsPath, updated);

  console.log(`Configured VS Code Copilot skills path: ${skillPath}`);
  console.log(`Updated: ${settingsPath}`);
}

if (command === "configure") {
  configure();
} else {
  console.log(`
Usage:
  your-org-copilot-skills configure

Optional:
  VSCODE_APP_NAME="Code - Insiders" your-org-copilot-skills configure
`);
}
