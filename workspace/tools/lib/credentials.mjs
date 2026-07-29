import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function getCloneCredentials(options) {
  let { soeid, token } = options;

  if (!soeid) {
    soeid = await promptText("SOEID: ");
  }

  if (!token) {
    token = await promptSecret("Git PAT token: ");
  }

  if (!soeid || !token) {
    throw new Error("Clone requires both SOEID and Git PAT token.");
  }

  return { soeid, token };
}

export function cleanHttpsUrl(project) {
  if (!project.repo) {
    throw new Error(`${project.name} is missing repo.`);
  }

  const repo = project.repo.trim();

  if (repo.startsWith("git@")) {
    throw new Error(`${project.name} uses an SSH repo URL. Use HTTPS host/path instead.`);
  }

  if (repo.startsWith("http://")) {
    throw new Error(`${project.name} uses http. Use https.`);
  }

  if (repo.startsWith("https://")) {
    return repo;
  }

  return `https://${repo.replace(/^\/+/, "")}`;
}

export function credentialedHttpsUrl(cleanUrl, soeid, token) {
  const url = new URL(cleanUrl);
  url.username = soeid;
  url.password = token;
  return url.toString();
}

async function promptText(message) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(message);
  rl.close();
  return answer.trim();
}

async function promptSecret(message) {
  if (!process.stdin.isTTY) {
    throw new Error("Cannot prompt for PAT token outside an interactive terminal. Set GIT_PAT_TOKEN.");
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";

    stdout.write(message);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char) => {
      if (char === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      }

      if (char === "\r" || char === "\n") {
        stdout.write("\n");
        stdin.setRawMode(false);
        stdin.off("data", onData);
        resolve(value.trim());
        return;
      }

      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    };

    stdin.on("data", onData);
  });
}
