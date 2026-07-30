# Department UI Workspace

This repo is a synthetic UI monorepo. It does not own the source for the UI apps.
Instead, it clones and orchestrates independent GitHub repos under `projects/`.

## First-Time Setup

```bash
git clone https://github.com/YOUR_ORG/dept-ui-workspace.git
cd dept-ui-workspace
npm run bootstrap -- --group <group-from-workspace.config.json>
```

Project-changing commands do not choose a default project set unless you add a
`defaultGroup` to `workspace.config.json`. Use `npm run run` for an interactive
picker, or pass `--group`, `--project`, or `--all`.

## Commands

```bash
npm run list
npm run clone
npm run install:all
npm run update
npm run run
npm run start
npm run status
npm run help
```

Target a group:

```bash
npm run clone -- --group <group-from-workspace.config.json>
npm run start -- --group <group-from-workspace.config.json>
npm run update -- --group <group-from-workspace.config.json>
```

Target every configured UI project:

```bash
npm run status -- --all
```

Target one project:

```bash
npm run start -- --project <project-from-workspace.config.json>
```

Choose what to run interactively. The command, group, and project choices all
come from `workspace.config.json`:

```bash
npm run run
```

The interactive group picker includes an all-projects option and shows how many
projects are available in each group.

Run a configured command without prompts:

```bash
npm run run -- --command <command-from-workspace.config.json> --group <group-from-workspace.config.json>
```

Limit parallel work:

```bash
npm run clone -- --concurrency 3
npm run update -- --concurrency 3
npm run run -- --command install --group <group-from-workspace.config.json> --concurrency 3
```

## Script Layout

Each action has its own script:

```txt
tools/
  bootstrap.mjs
  clone.mjs
  install.mjs
  update.mjs
  run.mjs
  start.mjs
  status.mjs
  list.mjs
  help.mjs
  lib/
    config.mjs
    commands.mjs
    concurrency.mjs
    credentials.mjs
    main.mjs
    project-runner.mjs
    prompts.mjs
    run.mjs
    terminal.mjs
```

The files under `tools/lib/` hold shared config parsing, credential prompts,
terminal formatting, and process helpers. The action files stay focused on one
job.

## HTTPS Clone Credentials

The clone command prompts each developer for:

```txt
SOEID
Git PAT token
```

It uses those values to clone with:

```txt
https://<soeid>:<git_pat_token>@<repo url>
```

After each clone succeeds, the script resets `origin` back to the clean HTTPS URL
without credentials so the PAT is not saved in `.git/config`.

When multiple selected projects are missing, clone starts them in parallel and
prefixes Git output with each project name.

For non-interactive use, set:

```bash
export GIT_SOEID="your-soeid"
export GIT_PAT_TOKEN="your-token"
```

## Config

Edit `workspace.config.json` and replace `YOUR_ORG` plus repo names with the real
department UI repos.

The config supports workspace-level command metadata and project-level command strings:

```json
{
  "defaultCommand": "start",
  "defaultConcurrency": 3,
  "commands": {
    "install": {
      "label": "Install dependencies",
      "description": "Install dependencies for selected projects",
      "concurrency": 3
    },
    "start": {
      "label": "Start dev servers",
      "description": "Run selected project dev servers",
      "longRunning": true
    }
  },
  "projects": [
    {
      "name": "compliance-base",
      "repo": "github.com/YOUR_ORG/compliance-base.git",
      "path": "compliance-testing/base-app",
      "branch": "main",
      "groups": ["compliance-testing", "all-ui"],
      "commands": {
        "install": "npm install",
        "start": "npm run start:host"
      }
    }
  ]
}
```

To add a new runnable action, add its metadata under the top-level `commands`
object, then add that command string under each project that supports it.

`repo` may be either:

```txt
github.com/YOUR_ORG/repo.git
https://github.com/YOUR_ORG/repo.git
```
