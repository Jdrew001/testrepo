#!/usr/bin/env node

import { loadSelection } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { cloneProjects } from "./clone.mjs";
import { installProjects } from "./install.mjs";
import { banner, section, plural } from "./lib/terminal.mjs";

export async function bootstrapSelected(argv = process.argv.slice(2)) {
  const { config, options, projects } = loadSelection(argv);

  banner("Bootstrap UI Workspace", plural(projects.length, "selected project"));
  section("Clone");
  await cloneProjects(config, projects, options);

  section("Install");
  await installProjects(config, projects);
}

if (isDirectRun(import.meta.url)) {
  runMain(bootstrapSelected);
}
