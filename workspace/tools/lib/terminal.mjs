const shouldColor = process.stdout.isTTY && !process.env.NO_COLOR;
const ansiPattern = /\u001b\[[0-9;]*m/g;

const codes = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m"
};

const palette = ["cyan", "green", "magenta", "blue", "yellow"];

export const color = Object.fromEntries(
  Object.keys(codes).map((name) => [name, (value) => paint(name, value)])
);

export function banner(title, subtitle = "") {
  const line = "=".repeat(Math.max(48, visibleLength(title) + 8));
  console.log("");
  console.log(color.cyan(line));
  console.log(color.bold(title));

  if (subtitle) {
    console.log(color.dim(subtitle));
  }

  console.log(color.cyan(line));
}

export function section(title, detail = "") {
  const suffix = detail ? ` ${color.dim(detail)}` : "";
  console.log("");
  console.log(`${color.bold(title)}${suffix}`);
}

export function info(message) {
  console.log(`${label("info", "blue")} ${message}`);
}

export function success(message) {
  console.log(`${label("ok", "green")} ${message}`);
}

export function warn(message) {
  console.log(`${label("warn", "yellow")} ${message}`);
}

export function failure(message) {
  console.error(`${label("error", "red")} ${message}`);
}

export function skip(message) {
  console.log(`${label("skip", "gray")} ${message}`);
}

export function commandLine(command) {
  console.log(`${label("run", "cyan")} ${color.dim(command)}`);
}

export function loadingIndicator(message) {
  if (!process.stdout.isTTY) {
    info(`${message}...`);
    return {
      stop() {}
    };
  }

  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;
  let lastWidth = 0;

  const render = () => {
    const text = `${color.cyan(frames[frameIndex])} ${message}...`;
    frameIndex = (frameIndex + 1) % frames.length;
    lastWidth = visibleLength(text);
    process.stdout.write(`\r${text}`);
  };

  const clear = () => {
    process.stdout.write(`\r${" ".repeat(lastWidth)}\r`);
  };

  render();
  const timer = setInterval(render, 120);
  timer.unref?.();

  return {
    stop() {
      clearInterval(timer);
      clear();
    }
  };
}

export function projectHeading(project, detail = "") {
  section(projectLabel(project.name), detail);
}

export function projectLabel(name) {
  return paint(projectColor(name), name);
}

export function outputPrefix(name) {
  return `${color.dim("[")}${projectLabel(name)}${color.dim("]")}`;
}

export function statusLabel(state) {
  if (state === "clean" || state === "cloned" || state === "installed" || state === "updated") {
    return label(state, "green");
  }

  if (state === "dirty" || state === "missing" || state === "skipped") {
    return label(state, "yellow");
  }

  return label(state, "gray");
}

export function table(columns, rows) {
  const widths = columns.map((column) => {
    const headerWidth = visibleLength(column.header);
    const rowWidth = rows.reduce((max, row) => Math.max(max, visibleLength(String(row[column.key] ?? ""))), 0);
    return Math.max(headerWidth, rowWidth);
  });

  const header = columns
    .map((column, index) => pad(column.header, widths[index]))
    .join("  ");

  console.log(color.dim(header));
  console.log(color.dim(widths.map((width) => "-".repeat(width)).join("  ")));

  for (const row of rows) {
    console.log(
      columns
        .map((column, index) => pad(String(row[column.key] ?? ""), widths[index]))
        .join("  ")
    );
  }
}

export function plural(count, singular, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function elapsed(startedAt) {
  const ms = Date.now() - startedAt;

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

export function stripAnsi(value) {
  return String(value).replace(ansiPattern, "");
}

function paint(name, value) {
  if (!shouldColor) {
    return String(value);
  }

  return `${codes[name]}${value}${codes.reset}`;
}

function label(text, colorName) {
  return paint(colorName, `[${text}]`);
}

function projectColor(name) {
  let total = 0;

  for (const char of name) {
    total += char.charCodeAt(0);
  }

  return palette[total % palette.length];
}

function pad(value, width) {
  const length = visibleLength(value);
  return `${value}${" ".repeat(Math.max(0, width - length))}`;
}

function visibleLength(value) {
  return stripAnsi(value).length;
}
