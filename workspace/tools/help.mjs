#!/usr/bin/env node

import { commandDefinitions } from "./lib/commands.mjs";
import { readConfig } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { banner, color, table } from "./lib/terminal.mjs";

export async function helpSelected() {
  const config = readConfig();
  const exampleGroup = config.defaultGroup || firstGroup(config) || "<group>";
  const exampleProject = config.projects[0]?.name || "<project>";
  const exampleCommand = config.defaultCommand || commandDefinitions(config)[0]?.name || "<command>";

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
      { command: "npm run run", description: "Interactively choose a command, group, and projects" },
      { command: "npm run start", description: "Start selected projects without prompts" },
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
      { selector: "--group <name>", example: `npm run start -- --group ${exampleGroup}` },
      { selector: "--project <name>", example: `npm run status -- --project ${exampleProject}` },
      { selector: "--command <name>", example: `npm run run -- --command ${exampleCommand} --group ${exampleGroup}` },
      { selector: "--concurrency <n>", example: "npm run update -- --concurrency 3" },
      { selector: "--all", example: "npm run update -- --all" }
    ]
  );

  console.log("");
  console.log(color.bold("Runnable Commands"));
  table(
    [
      { key: "command", header: "command" },
      { key: "mode", header: "mode" },
      { key: "description", header: "description" }
    ],
    commandDefinitions(config).map((definition) => ({
      command: definition.name,
      mode: definition.longRunning ? "long-running" : "finite",
      description: definition.description || definition.label
    }))
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

function firstGroup(config) {
  for (const project of config.projects) {
    if (Array.isArray(project.groups) && project.groups.length > 0) {
      return project.groups[0];
    }
  }

  return "";
}
