# Department UI Workspace

This repo is a synthetic UI monorepo. It does not own the source for the UI apps.
Instead, it clones and orchestrates independent GitHub repos under `projects/`.

## First-Time Setup

```bash
git clone https://github.com/YOUR_ORG/dept-ui-workspace.git
cd dept-ui-workspace
npm run bootstrap
```

By default, commands target the `compliance-testing` group from `workspace.config.json`.

## Commands

```bash
npm run list
npm run clone
npm run install:all
npm run update
npm run start
npm run status
npm run help
```

Target a group:

```bash
npm run clone -- --group compliance-testing
npm run start -- --group compliance-testing
npm run update -- --group all-ui
```

Target every configured UI project:

```bash
npm run status -- --all
```

Target one project:

```bash
npm run start -- --project compliance-base
```

## Script Layout

Each action has its own script:

```txt
tools/
  bootstrap.mjs
  clone.mjs
  install.mjs
  update.mjs
  start.mjs
  status.mjs
  list.mjs
  help.mjs
  lib/
    config.mjs
    credentials.mjs
    main.mjs
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

For non-interactive use, set:

```bash
export GIT_SOEID="your-soeid"
export GIT_PAT_TOKEN="your-token"
```

## Config

Edit `workspace.config.json` and replace `YOUR_ORG` plus repo names with the real
department UI repos.

Each project supports:

```json
{
  "name": "compliance-base",
  "repo": "github.com/YOUR_ORG/compliance-base.git",
  "path": "compliance-testing/base-app",
  "branch": "main",
  "groups": ["compliance-testing", "all-ui"],
  "install": "npm install",
  "start": "npm run start:host"
}
```

`repo` may be either:

```txt
github.com/YOUR_ORG/repo.git
https://github.com/YOUR_ORG/repo.git
```
