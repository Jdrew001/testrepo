#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { commandDefinition } from "./lib/commands.mjs";
import { mapConcurrent, resolveConcurrency } from "./lib/concurrency.mjs";
import { cleanHttpsUrl, credentialedHttpsUrl, getCloneCredentials } from "./lib/credentials.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { loadSelection, projectDir, rootDir } from "./lib/config.mjs";
import { run } from "./lib/run.mjs";
import { banner, elapsed, info, plural, projectHeading, skip, statusLabel, success, table } from "./lib/terminal.mjs";

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
  const concurrency = resolveConcurrency(config, options, commandDefinition(config, "clone"), missing.length);
  info(`Cloning ${plural(missing.length, "project")} with concurrency ${concurrency}.`);

  const results = await mapConcurrent(
    missing,
    concurrency,
    (project) => cloneProject(config, project, { soeid, token }, missing.length === 1)
  );
  const failures = results
    .map((result, index) => ({ result, project: missing[index] }))
    .filter(({ result }) => result.status === "rejected");

  table(
    [
      { key: "project", header: "project" },
      { key: "status", header: "status" },
      { key: "duration", header: "duration" }
    ],
    results.map((result, index) => ({
      project: missing[index].name,
      status: statusLabel(result.status === "fulfilled" ? "cloned" : "failed"),
      duration: result.status === "fulfilled" ? result.value.duration : "-"
    }))
  );

  if (failures.length > 0) {
    throw new Error(
      failures
        .map(({ project, result }) => `${project.name}: ${result.reason.message}`)
        .join("\n")
    );
  }

  success(`Cloned ${plural(missing.length, "project")} in ${elapsed(startedAt)}.`);
}

async function cloneProject(config, project, credentials, showLoader) {
  const startedAt = Date.now();
  const targetDir = projectDir(config, project);
  const cleanUrl = cleanHttpsUrl(project);
  const cloneUrl = credentialedHttpsUrl(cleanUrl, credentials.soeid, credentials.token);

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  projectHeading(project, `clone into ${path.relative(rootDir, targetDir)}`);
  await run("git", ["clone", "--verbose", "--progress", cloneUrl, targetDir], rootDir, {
    loadingMessage: showLoader ? `Cloning ${project.name}` : "",
    name: project.name,
    redact: credentials.token
  });

  info(`${project.name}: resetting origin URL without credentials`);
  await run("git", ["remote", "set-url", "origin", cleanUrl], targetDir, { name: project.name });

  if (project.branch) {
    info(`${project.name}: checking out ${project.branch}`);
    await run("git", ["checkout", project.branch], targetDir, { name: project.name });
  }

  success(`${project.name} cloned`);
  return { duration: elapsed(startedAt) };
}

if (isDirectRun(import.meta.url)) {
  runMain(cloneSelected);
}
