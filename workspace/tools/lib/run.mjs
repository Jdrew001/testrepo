import { spawn } from "node:child_process";
import { commandLine, loadingIndicator, outputPrefix } from "./terminal.mjs";

export function run(command, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.printCommand !== false) {
      commandLine([command, ...args.map((arg) => redact(arg, options.redact))].join(" "));
    }

    let loader = options.loadingMessage ? loadingIndicator(options.loadingMessage) : null;
    const stopLoader = () => {
      loader?.stop();
      loader = null;
    };

    const child = spawn(command, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      stopLoader();
      writeOutput(chunk, process.stdout, options);
    });
    child.stderr.on("data", (chunk) => {
      stopLoader();
      writeOutput(chunk, process.stderr, options);
    });
    child.on("error", (error) => {
      stopLoader();
      reject(error);
    });
    child.on("close", (code) => {
      stopLoader();
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

export function runShell(command, cwd, name) {
  return new Promise((resolve, reject) => {
    commandLine(command);
    const child = spawnShell(command, cwd, name);
    child.on("error", reject);
    child.on("close", (code) => {
      code === 0
        ? resolve()
        : reject(new Error(`[${name}] command exited with code ${code}`));
    });
  });
}

export function spawnShell(command, cwd, name) {
  const child = spawn(command, {
    cwd,
    shell: true,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => writePrefixed(name, chunk, process.stdout));
  child.stderr.on("data", (chunk) => writePrefixed(name, chunk, process.stderr));

  return child;
}

export function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
        resolve();
      } else {
        reject(new Error(`start command exited with code ${code}`));
      }
    });
  });
}

export function capture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      code === 0
        ? resolve(stdout)
        : reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function writePrefixed(name, chunk, stream) {
  const lines = String(chunk).split(/\r?\n|\r/);

  for (const line of lines) {
    if (line.length > 0) {
      stream.write(`${outputPrefix(name)} ${line}\n`);
    }
  }
}

function writeOutput(chunk, stream, options) {
  const value = redact(String(chunk), options.redact);

  if (options.name) {
    writePrefixed(options.name, value, stream);
  } else {
    stream.write(value);
  }
}

function redact(value, secret) {
  return secret ? value.split(secret).join("[redacted]") : value;
}
