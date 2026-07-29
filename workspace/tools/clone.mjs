#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { cleanHttpsUrl, credentialedHttpsUrl, getCloneCredentials } from "./lib/credentials.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { loadSelection, projectDir, rootDir } from "./lib/config.mjs";
import { run } from "./lib/run.mjs";
import { banner, elapsed, info, plural, projectHeading, skip, success } from "./lib/terminal.mjs";

export async function cloneSelected(argv = process.argv.slice(2)) {
  const { config, options, projects } = loadSelection(argv);
  banner("Clone UI Projects", plural(projects.length, "selected project"));
  await cloneProjects(config, projects, options);
}

export async function cloneProjects(config, projects, options) {
  const startedAt = Date.now();
  const missing = [];

  for (const project of projects) {
    const targetDir = projectDir(config, project);

    if (fs.existsSync(path.join(targetDir, ".git"))) {
      skip(`${project.name} is already cloned`);
      continue;
    }

    if (fs.existsSync(targetDir)) {
      throw new Error(`${project.name} exists but is not a Git repo: ${targetDir}`);
    }

    missing.push(project);
  }

  if (missing.length === 0) {
    success(`Nothing to clone. Finished in ${elapsed(startedAt)}.`);
    return;
  }

  info("Credentials are used only for clone. Origin is reset without the PAT after each clone.");
  const { soeid, token } = await getCloneCredentials(options);

  for (const project of missing) {
    const targetDir = projectDir(config, project);
    const cleanUrl = cleanHttpsUrl(project);
    const cloneUrl = credentialedHttpsUrl(cleanUrl, soeid, token);

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    projectHeading(project, `clone into ${path.relative(rootDir, targetDir)}`);
    await run("git", ["clone", cloneUrl, targetDir], rootDir, { redact: token });

    info("Resetting origin URL without credentials");
    await run("git", ["remote", "set-url", "origin", cleanUrl], targetDir);

    if (project.branch) {
      info(`Checking out ${project.branch}`);
      await run("git", ["checkout", project.branch], targetDir);
    }

    success(`${project.name} cloned`);
  }

  success(`Cloned ${plural(missing.length, "project")} in ${elapsed(startedAt)}.`);
}

if (isDirectRun(import.meta.url)) {
  runMain(cloneSelected);
}
