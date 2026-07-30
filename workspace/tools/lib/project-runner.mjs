import { projectCommand, runnableProjects } from "./commands.mjs";
import { mapConcurrent, resolveConcurrency } from "./concurrency.mjs";
import { requireProjectDir } from "./config.mjs";
import { runShell } from "./run.mjs";
import { elapsed, info, plural, projectHeading, statusLabel, table } from "./terminal.mjs";

export async function runFiniteProjectCommand(config, projects, definition, options = {}) {
  const runnable = runnableProjects(projects, definition.name);

  if (runnable.length === 0) {
    throw new Error(`No selected projects define the ${definition.name} command.`);
  }

  const concurrency = resolveConcurrency(config, options, definition);
  const startedAt = Date.now();

  info(`Running ${definition.label} for ${plural(runnable.length, "project")} with concurrency ${concurrency}.`);

  const results = await mapConcurrent(runnable, concurrency, async (project) => {
    const cwd = requireProjectDir(config, project);
    const command = projectCommand(project, definition.name);
    const projectStartedAt = Date.now();

    projectHeading(project, command);
    await runShell(command, cwd, project.name);

    return {
      command,
      duration: elapsed(projectStartedAt),
      project: project.name
    };
  });

  const rows = results.map((result, index) => {
    const project = runnable[index];

    if (result.status === "fulfilled") {
      return {
        command: result.value.command,
        duration: result.value.duration,
        project: project.name,
        status: statusLabel("done")
      };
    }

    return {
      command: projectCommand(project, definition.name) || "-",
      duration: "-",
      project: project.name,
      status: statusLabel("failed")
    };
  });

  table(
    [
      { key: "project", header: "project" },
      { key: "status", header: "status" },
      { key: "duration", header: "duration" },
      { key: "command", header: "command" }
    ],
    rows
  );

  const failures = results
    .map((result, index) => ({ result, project: runnable[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    throw new Error(
      failures
        .map(({ project, result }) => `${project.name}: ${result.reason.message}`)
        .join("\n")
    );
  }

  info(`${definition.label} finished in ${elapsed(startedAt)}.`);
}
