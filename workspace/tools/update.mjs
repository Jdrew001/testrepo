#!/usr/bin/env node

import { commandDefinition } from "./lib/commands.mjs";
import { mapConcurrent, resolveConcurrency } from "./lib/concurrency.mjs";
import { loadSelection, requireProjectDir } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { run } from "./lib/run.mjs";
import { banner, elapsed, info, plural, projectHeading, statusLabel, success, table } from "./lib/terminal.mjs";

export async function updateSelected(argv = process.argv.slice(2)) {
  const { config, options, projects } = loadSelection(argv);
  banner("Update UI Projects", plural(projects.length, "selected project"));
  await updateProjects(config, projects, options);
}

export async function updateProjects(config, projects, options = {}) {
  const startedAt = Date.now();
  const concurrency = resolveConcurrency(config, options, commandDefinition(config, "update"), projects.length);

  info(`Updating ${plural(projects.length, "project")} with concurrency ${concurrency}.`);

  const results = await mapConcurrent(projects, concurrency, async (project) => {
    const cwd = requireProjectDir(config, project);
    const projectStartedAt = Date.now();

    projectHeading(project, "fetch and fast-forward");
    info(`${project.name}: fetching latest changes`);
    await run("git", ["fetch", "--prune"], cwd, { name: project.name });

    if (project.branch) {
      info(`${project.name}: checking out ${project.branch}`);
      await run("git", ["checkout", project.branch], cwd, { name: project.name });
    }

    info(`${project.name}: pulling with --ff-only`);
    await run("git", ["pull", "--ff-only"], cwd, { name: project.name });

    return {
      duration: elapsed(projectStartedAt),
      project: project.name
    };
  });

  table(
    [
      { key: "project", header: "project" },
      { key: "status", header: "status" },
      { key: "duration", header: "duration" }
    ],
    results.map((result, index) => ({
      project: projects[index].name,
      status: statusLabel(result.status === "fulfilled" ? "updated" : "failed"),
      duration: result.status === "fulfilled" ? result.value.duration : "-"
    }))
  );

  const failures = results
    .map((result, index) => ({ result, project: projects[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    throw new Error(
      failures
        .map(({ project, result }) => `${project.name}: ${result.reason.message}`)
        .join("\n")
    );
  }

  success(`Updated ${plural(projects.length, "project")} in ${elapsed(startedAt)}.`);
}

if (isDirectRun(import.meta.url)) {
  runMain(updateSelected);
}
