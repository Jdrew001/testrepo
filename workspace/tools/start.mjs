#!/usr/bin/env node

import { projectCommand, runnableProjects } from "./lib/commands.mjs";
import { loadSelection, projectDir, requireProjectDir } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { spawnShell, waitForExit } from "./lib/run.mjs";
import { banner, info, plural, projectHeading, success, warn } from "./lib/terminal.mjs";

export async function startSelected(argv = process.argv.slice(2)) {
  const { config, projects } = loadSelection(argv);
  banner("Start UI Projects", plural(projects.length, "selected project"));
  await startProjects(config, projects);
}

export async function startProjects(config, projects, commandName = "start") {
  const runnable = runnableProjects(projects, commandName);

  if (runnable.length === 0) {
    throw new Error(`No selected projects define a ${commandName} command.`);
  }

  info("Press Ctrl-C once to stop every started project.");

  for (const project of runnable) {
    requireProjectDir(config, project);
  }

  const children = runnable.map((project) => {
    const cwd = projectDir(config, project);
    const command = projectCommand(project, commandName);
    projectHeading(project, command);
    return spawnShell(command, cwd, project.name);
  });

  const stop = () => {
    warn("Stopping running UI projects...");

    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGINT");
      }
    }
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await Promise.all(children.map((child) => waitForExit(child)));
  success("All start processes finished.");
}

if (isDirectRun(import.meta.url)) {
  runMain(startSelected);
}
