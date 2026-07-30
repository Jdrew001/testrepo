#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const skillsDir = path.join(process.cwd(), "skills");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(skillsDir)) fail("Missing skills/ directory.");

for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
  if (!fs.existsSync(skillFile)) fail(`Missing ${entry.name}/SKILL.md`);

  const content = fs.readFileSync(skillFile, "utf8");
  const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim();

  if (!content.startsWith("---")) fail(`${entry.name}/SKILL.md missing frontmatter`);
  if (!name) fail(`${entry.name}/SKILL.md missing name`);
  if (!description) fail(`${entry.name}/SKILL.md missing description`);
  if (name !== entry.name) fail(`${entry.name}/SKILL.md name must match folder name`);
}

console.log("Skills validated.");
