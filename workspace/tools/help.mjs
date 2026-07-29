#!/usr/bin/env node

import { readConfig } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { banner, color, table } from "./lib/terminal.mjs";

export async function helpSelected() {
  const config = readConfig();

  banner("Department UI Workspace", "Synthetic workspace for independent UI repos");

  table(
    [
      { key: "command", header: "command" },
      { key: "description", header: "description" }
    ],
    [
      { command: "npm run bootstrap", description: "Clone missing projects, then install dependencies" },
      { command: "npm run clone", description: "Clone missing projects over HTTPS with SOEID and PAT" },
      { command: "npm run install:all", description: "Run each project's configured install command" },
      { command: "npm run update", description: "Fetch, checkout configured branch, and pull --ff-only" },
      { command: "npm run start", description: "Run each project's configured start command" },
      { command: "npm run status", description: "Show branch, commit, path, and dirty state" },
      { command: "npm run list", description: "List configured projects" }
    ]
  );

  console.log("");
  console.log(color.bold("Selectors"));
  console.log(`${color.dim("Default group:")} ${config.defaultGroup || "(none)"}`);
  console.log("");

  table(
    [
      { key: "selector", header: "selector" },
      { key: "example", header: "example" }
    ],
    [
      { selector: "--group <name>", example: "npm run start -- --group compliance-testing" },
      { selector: "--project <name>", example: "npm run status -- --project compliance-base" },
      { selector: "--all", example: "npm run update -- --all" }
    ]
  );

  console.log("");
  console.log(color.bold("Clone Credentials"));
  console.log(`${color.dim("Prompted:")} SOEID and Git PAT token`);
  console.log(`${color.dim("Optional env:")} GIT_SOEID and GIT_PAT_TOKEN`);
  console.log(`${color.dim("Safety:")} origin is reset without credentials after clone`);
}

if (isDirectRun(import.meta.url)) {
  runMain(helpSelected);
}
