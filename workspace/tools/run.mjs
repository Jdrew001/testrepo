#!/usr/bin/env node

import { commandDefinition, commandDefinitions, projectCommand, runnableProjects } from "./lib/commands.mjs";
import { parseProjectArgs, readConfig, selectProjects } from "./lib/config.mjs";
import { isDirectRun, runMain } from "./lib/main.mjs";
import { runFiniteProjectCommand } from "./lib/project-runner.mjs";
import { chooseMany, chooseOne } from "./lib/prompts.mjs";
import { banner, panel, plural } from "./lib/terminal.mjs";
import { startProjects } from "./start.mjs";

const allProjectsValue = "__all_projects__";

export async function runSelected(argv = process.argv.slice(2)) {
  const config = readConfig();
  const options = parseProjectArgs(argv);
  const { definition, projects } = argv.length > 0
    ? resolveRunSelection(config, options)
    : await promptRunSelection(config);

  banner(definition.label, plural(projects.length, "selected project"));
  panel("Run Plan", [
    { label: "command", value: definition.name },
    { label: "mode", value: definition.longRunning ? "long-running" : "finite" },
    { label: "projects", value: projectSummary(projects) },
    { label: "concurrency", value: definition.longRunning ? "all selected" : options.concurrency ?? definition.concurrency ?? config.defaultConcurrency ?? 3 }
  ]);

  if (definition.longRunning) {
    await startProjects(config, projects, definition.name);
  } else {
    await runFiniteProjectCommand(config, projects, definition, options);
  }
}

function resolveRunSelection(config, options) {
  const commandName = options.command || config.defaultCommand;

  if (!commandName) {
    throw new Error("No command selected. Use --command <name> or set defaultCommand in workspace.config.json.");
  }

  const definition = commandDefinition(config, commandName);
  const selectedBaseProjects = selectProjects(config, options);

  if (selectedBaseProjects.length === 0) {
    throw new Error("No projects selected. Use --group <name>, --project <name>, or --all.");
  }

  const selectedProjects = runnableProjects(selectedBaseProjects, definition.name);

  if (selectedProjects.length === 0) {
    throw new Error(`No selected projects define the ${definition.name} command.`);
  }

  return { definition, projects: selectedProjects };
}

async function promptRunSelection(config) {
  const definitions = commandDefinitions(config);

  if (definitions.length === 0) {
    throw new Error("No runnable commands found in workspace.config.json.");
  }

  const commandName = await chooseOne(
    "Select a command",
    definitions.map((definition) => ({
      detail: definition.description,
      label: definition.label,
      value: definition.name
    })),
    {
      initialValue: config.defaultCommand || definitions[0].name
    }
  );
  const definition = commandDefinition(config, commandName);
  const runnable = runnableProjects(config.projects, definition.name);
  const groups = projectGroups(runnable);
  const selectedGroup = groups.length > 0
    ? await chooseOne("Select a project group", groupChoices(groups, config.defaultGroup, runnable), {
      initialValue: groups.includes(config.defaultGroup) ? config.defaultGroup : allProjectsValue
    })
    : allProjectsValue;
  const groupedProjects = selectedGroup === allProjectsValue
    ? runnable
    : runnable.filter((project) =>
      Array.isArray(project.groups) && project.groups.includes(selectedGroup)
    );
  const selectedProjectNames = await chooseMany(
    "Select projects to run",
    groupedProjects.map((project) => ({
      detail: projectCommand(project, definition.name),
      label: project.name,
      value: project.name
    }))
  );
  const selected = new Set(selectedProjectNames);

  return {
    definition,
    projects: groupedProjects.filter((project) => selected.has(project.name))
  };
}

function projectGroups(projects) {
  const groups = new Set();

  for (const project of projects) {
    if (Array.isArray(project.groups)) {
      for (const group of project.groups) {
        groups.add(group);
      }
    }
  }

  return [...groups].sort((left, right) => left.localeCompare(right));
}

function groupChoices(groups, defaultGroup, projects) {
  const counts = projectGroupCounts(projects);
  const orderedGroups = defaultGroup && groups.includes(defaultGroup)
    ? [defaultGroup, ...groups.filter((group) => group !== defaultGroup)]
    : groups;
  const choices = orderedGroups.map((group) => ({
    detail: plural(counts.get(group) ?? 0, "project"),
    label: group === defaultGroup ? `${group} (default)` : group,
    value: group
  }));
  const allChoice = {
    detail: plural(projects.length, "project"),
    label: "All projects",
    value: allProjectsValue
  };

  return defaultGroup && groups.includes(defaultGroup)
    ? [choices[0], allChoice, ...choices.slice(1)]
    : [allChoice, ...choices];
}

function projectGroupCounts(projects) {
  const counts = new Map();

  for (const project of projects) {
    if (Array.isArray(project.groups)) {
      for (const group of project.groups) {
        counts.set(group, (counts.get(group) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function projectSummary(projects) {
  const names = projects.map((project) => project.name);

  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${plural(names.length, "project")} selected (${names.slice(0, 2).join(", ")}, +${names.length - 2} more)`;
}

if (isDirectRun(import.meta.url)) {
  runMain(runSelected);
}
