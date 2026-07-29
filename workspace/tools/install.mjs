#!/usr/bin/env node

import { loadSelection, requireProjectDir } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { runShell } from "./lib/run.mjs";
import { banner, elapsed, plural, projectHeading, success } from "./lib/terminal.mjs";

export async function installSelected(argv = process.argv.slice(2)) {
  const { config, projects } = loadSelection(argv);
  banner("Install UI Dependencies", plural(projects.length, "selected project"));
  await installProjects(config, projects);
}

export async function installProjects(config, projects) {
  const startedAt = Date.now();

  for (const project of projects) {
    const cwd = requireProjectDir(config, project);
    const command = project.install || "npm install";

    projectHeading(project, command);
    await runShell(command, cwd, project.name);
    success(`${project.name} dependencies installed`);
  }

  success(`Installed ${plural(projects.length, "project")} in ${elapsed(startedAt)}.`);
}

if (isDirectRun(import.meta.url)) {
  runMain(installSelected);
}
