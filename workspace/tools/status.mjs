#!/usr/bin/env node

import fs from "node:fs";
import { loadSelection, projectDir } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { capture } from "./lib/run.mjs";
import { banner, plural, statusLabel, table } from "./lib/terminal.mjs";

export async function statusSelected(argv = process.argv.slice(2)) {
  const { config, projects } = loadSelection(argv);
  banner("UI Project Status", plural(projects.length, "selected project"));
  await statusProjects(config, projects);
}

export async function statusProjects(config, projects) {
  const rows = [];

  for (const project of projects) {
    const cwd = projectDir(config, project);

    if (!fs.existsSync(cwd)) {
      rows.push({
        project: project.name,
        state: statusLabel("missing"),
        branch: "-",
        commit: "-",
        path: project.path
      });
      continue;
    }

    const branch = await capture("git", ["branch", "--show-current"], cwd);
    const sha = await capture("git", ["rev-parse", "--short", "HEAD"], cwd);
    const dirty = await capture("git", ["status", "--porcelain"], cwd);
    const state = dirty.trim() ? "dirty" : "clean";

    rows.push({
      project: project.name,
      state: statusLabel(state),
      branch: branch.trim() || "(detached)",
      commit: sha.trim(),
      path: project.path
    });
  }

  table(
    [
      { key: "project", header: "project" },
      { key: "state", header: "state" },
      { key: "branch", header: "branch" },
      { key: "commit", header: "commit" },
      { key: "path", header: "path" }
    ],
    rows
  );
}

if (isDirectRun(import.meta.url)) {
  runMain(statusSelected);
}
