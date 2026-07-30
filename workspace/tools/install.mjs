#!/usr/bin/env node

import { commandDefinition } from "./lib/commands.mjs";
import { loadSelection } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { runFiniteProjectCommand } from "./lib/project-runner.mjs";
import { banner, plural } from "./lib/terminal.mjs";

export async function installSelected(argv = process.argv.slice(2)) {
  const { config, options, projects } = loadSelection(argv);
  banner("Install UI Dependencies", plural(projects.length, "selected project"));
  await installProjects(config, projects, options);
}

export async function installProjects(config, projects, options = {}) {
  await runFiniteProjectCommand(config, projects, commandDefinition(config, "install"), options);
}

if (isDirectRun(import.meta.url)) {
  runMain(installSelected);
}
