#!/usr/bin/env node

import { loadSelection, requireProjectDir } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { run } from "./lib/run.mjs";
import { banner, elapsed, info, plural, projectHeading, success } from "./lib/terminal.mjs";

export async function updateSelected(argv = process.argv.slice(2)) {
  const { config, projects } = loadSelection(argv);
  banner("Update UI Projects", plural(projects.length, "selected project"));
  await updateProjects(config, projects);
}

export async function updateProjects(config, projects) {
  const startedAt = Date.now();

  for (const project of projects) {
    const cwd = requireProjectDir(config, project);

    projectHeading(project, "fetch and fast-forward");
    info("Fetching latest changes");
    await run("git", ["fetch", "--prune"], cwd);

    if (project.branch) {
      info(`Checking out ${project.branch}`);
      await run("git", ["checkout", project.branch], cwd);
    }

    info("Pulling with --ff-only");
    await run("git", ["pull", "--ff-only"], cwd);
    success(`${project.name} updated`);
  }

  success(`Updated ${plural(projects.length, "project")} in ${elapsed(startedAt)}.`);
}

if (isDirectRun(import.meta.url)) {
  runMain(updateSelected);
}
