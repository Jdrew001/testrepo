const legacyCommandNames = ["install", "start"];

export function commandDefinitions(config, projects = config.projects) {
  const names = new Set(Object.keys(config.commands ?? {}));

  for (const project of projects) {
    for (const name of Object.keys(project.commands ?? {})) {
      names.add(name);
    }

    for (const name of legacyCommandNames) {
      if (typeof project[name] === "string" && project[name].trim()) {
        names.add(name);
      }
    }
  }

  return [...names]
    .map((name) => commandDefinition(config, name))
    .filter((definition) => hasRunnableProject(projects, definition.name))
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

export function commandDefinition(config, name) {
  const metadata = config.commands?.[name] ?? {};
  const normalized = typeof metadata === "string"
    ? { label: metadata }
    : metadata;

  return {
    concurrency: normalized.concurrency,
    description: normalized.description ?? "",
    label: normalized.label ?? titleize(name),
    longRunning: normalized.longRunning === true,
    name,
    order: Number.isFinite(normalized.order) ? normalized.order : 100
  };
}

export function projectCommand(project, commandName, fallback = "") {
  const command = project.commands?.[commandName] ?? project[commandName] ?? fallback;
  return typeof command === "string" ? command.trim() : "";
}

export function projectCommandNames(project) {
  const names = new Set(Object.keys(project.commands ?? {}));

  for (const name of legacyCommandNames) {
    if (typeof project[name] === "string" && project[name].trim()) {
      names.add(name);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function runnableProjects(projects, commandName) {
  return projects.filter((project) => projectCommand(project, commandName));
}

export function hasRunnableProject(projects, commandName) {
  return runnableProjects(projects, commandName).length > 0;
}

function titleize(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
