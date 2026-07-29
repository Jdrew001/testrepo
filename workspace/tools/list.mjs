#!/usr/bin/env node

import { parseProjectArgs, readConfig, selectProjects } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { banner, color, plural, table } from "./lib/terminal.mjs";

export async function listSelected(argv = process.argv.slice(2)) {
  const options = parseProjectArgs(argv);
  const config = readConfig();
  const projects = selectProjects(config, options);

  banner("Configured UI Projects", plural(projects.length, "selected project"));
  console.log(`${color.dim("Projects dir:")} ${config.projectsDir}`);
  console.log(`${color.dim("Default group:")} ${config.defaultGroup || "(none)"}`);
  console.log("");

  table(
    [
      { key: "project", header: "project" },
      { key: "groups", header: "groups" },
      { key: "path", header: "path" },
      { key: "repo", header: "repo" }
    ],
    projects.map((project) => ({
      project: project.name,
      groups: Array.isArray(project.groups) ? project.groups.join(", ") : "",
      path: project.path,
      repo: project.repo
    }))
  );
}

if (isDirectRun(import.meta.url)) {
  runMain(listSelected);
}
