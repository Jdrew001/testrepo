import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(libDir, "../..");
export const configPath = path.join(rootDir, "workspace.config.json");

export function loadSelection(argv = process.argv.slice(2)) {
  const options = parseProjectArgs(argv);
  const config = readConfig();
  const projects = selectProjects(config, options);

  if (projects.length === 0) {
    throw new Error("No projects selected. Use --group <name>, --project <name>, or --all.");
  }

  return { config, options, projects };
}

export function readConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config file: ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (!Array.isArray(config.projects)) {
    throw new Error("workspace.config.json must contain a projects array.");
  }

  return {
    commands: config.commands ?? {},
    defaultCommand: config.defaultCommand ?? "",
    defaultConcurrency: config.defaultConcurrency ?? null,
    projectsDir: config.projectsDir ?? "projects",
    defaultGroup: config.defaultGroup,
    projects: config.projects
  };
}

export function parseProjectArgs(argv) {
  const options = {
    all: false,
    command: "",
    concurrency: null,
    groups: [],
    projects: [],
    soeid: process.env.GIT_SOEID || "",
    token: process.env.GIT_PAT_TOKEN || ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--group" || arg === "-g") {
      options.groups.push(requireValue(argv, ++i, arg));
    } else if (arg.startsWith("--group=")) {
      options.groups.push(arg.slice("--group=".length));
    } else if (arg === "--project" || arg === "-p") {
      options.projects.push(requireValue(argv, ++i, arg));
    } else if (arg.startsWith("--project=")) {
      options.projects.push(arg.slice("--project=".length));
    } else if (arg === "--command" || arg === "-c") {
      options.command = requireValue(argv, ++i, arg);
    } else if (arg.startsWith("--command=")) {
      options.command = arg.slice("--command=".length);
    } else if (arg === "--concurrency") {
      options.concurrency = parseConcurrency(requireValue(argv, ++i, arg), arg);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseConcurrency(arg.slice("--concurrency=".length), "--concurrency");
    } else if (arg === "--soeid") {
      options.soeid = requireValue(argv, ++i, arg);
    } else if (arg.startsWith("--soeid=")) {
      options.soeid = arg.slice("--soeid=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function selectProjects(config, options, selectionOptions = {}) {
  if (options.all) {
    return config.projects;
  }

  if (options.projects.length > 0) {
    const wanted = new Set(options.projects);
    return config.projects.filter((project) => wanted.has(project.name));
  }

  const groups = options.groups.length > 0
    ? options.groups
    : config.defaultGroup && selectionOptions.useDefaultGroup !== false
      ? [config.defaultGroup]
      : [];

  if (groups.includes("all")) {
    return config.projects;
  }

  if (groups.length === 0) {
    return selectionOptions.defaultToAll ? config.projects : [];
  }

  const wanted = new Set(groups);
  return config.projects.filter((project) =>
    Array.isArray(project.groups) && project.groups.some((group) => wanted.has(group))
  );
}

export function projectDir(config, project) {
  if (!project.path) {
    throw new Error(`${project.name} is missing path.`);
  }

  return path.join(rootDir, config.projectsDir, project.path);
}

export function requireProjectDir(config, project) {
  const cwd = projectDir(config, project);

  if (!fs.existsSync(cwd)) {
    throw new Error(`${project.name} is not cloned. Run clone first.`);
  }

  return cwd;
}

function requireValue(args, index, flag) {
  const value = args[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function parseConcurrency(value, flag) {
  const concurrency = Number.parseInt(value, 10);

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`${flag} requires a positive integer.`);
  }

  return concurrency;
}
