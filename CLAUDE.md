# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Build (TypeScript → dist/)
npm run build

# Run in development (no build step, tsx hot-reload)
npm run dev

# Run compiled server (with Windows system CA for corporate TLS)
npm start

# Run compiled server (skip TLS verification)
npm run start:insecure

# Diagnose Redmine connectivity before wiring up the MCP server
node --use-system-ca scripts/test-connection.mjs

# Smoke-test via MCP Inspector (opens browser UI)
npx @modelcontextprotocol/inspector node dist/index.js
```

There is no test suite. Functionality is verified manually through the MCP Inspector or `scripts/test-connection.mjs`.

## Architecture

### Module system
TypeScript ESM project (`"type": "module"`) with `NodeNext` module resolution. All internal imports must use `.js` extensions (resolved to `.ts` at build time).

### Startup flow
`src/index.ts` → `registerTools()` → MCP `StdioServerTransport`

Config is validated eagerly at import time in `src/config.ts` using a Zod schema. If any required env var is missing or malformed the process exits immediately with a descriptive message.

### Data flow for `redmine_get_issue_report`
1. `RedmineClient.getIssue()` — fetches issue JSON from Redmine REST API including journals, changesets, attachments, relations and children.
2. `getCommitInfo()` / `getBranchInfo()` (optional) — uses `simple-git` to pull commit metadata and a unified diff (truncated at 12 000 chars) from the local repo pointed to by `GIT_REPO_PATH`.
3. `buildReport()` — assembles a Markdown document from individual section builder functions in `src/report/sections.ts`.
4. `writeReport()` — optionally persists the Markdown file to `REPORT_OUTPUT_DIR/redmine-<id>.md`.

### Report sections (`src/report/sections.ts`)
Each section function receives the `RedmineIssue` and an optional `GitContext`. The functions auto-populate content by:
- scanning journal notes for domain keywords (DB, auth, config keywords are pattern-matched)
- parsing the unified diff with `extractNewCode()` / `extractNewCodeGeneral()` which splits on `diff --git` headers and classifies files by path patterns (`DB_PATTERNS`, `AUTH_PATTERNS`, `CONFIG_PATTERNS`)
- rendering added lines as syntax-highlighted code blocks (extension → language via `EXT_LANG` map)

### HTTP client (`src/redmine/client.ts`)
Uses `undici` instead of Node's built-in `fetch` when `REDMINE_TLS_INSECURE=true` is set, allowing a custom `Agent` with `rejectUnauthorized: false`. For normal TLS the native `fetch` is used. The recommended alternative for corporate CAs is running Node with `--use-system-ca` (Node 22+).

### MCP tools registered
| Tool | Description |
|---|---|
| `redmine_get_issue_report` | Main tool — fetches issue + optional Git context, returns Markdown report |
| `redmine_ping` | Connectivity diagnostic — returns structured result with human-readable diagnosis |

## Environment configuration

Copy `.env.example` to `.env`:

```env
REDMINE_URL=https://redmine.miempresa.com   # required
REDMINE_API_KEY=xxxxxxxx                    # required
REDMINE_TLS_INSECURE=false                  # optional, use only if --use-system-ca fails
GIT_DEFAULT_BRANCH=develop                  # optional, default: develop
GIT_REPO_PATH=C:\Code\MiProyecto           # optional, default: cwd
REPORT_OUTPUT_DIR=./reports                 # optional, default: ./reports
```

## Report generation — AI instructions (from `.github/copilot-instructions.md`)

When the tool returns raw data and the AI is asked to complete the report, apply these rules:

- **Language**: Spanish, third person, technical and concise.
- **Análisis**: describe the prior state, the problem, functional impact, and what this issue fixes.
- **Diseño de la solución**: explain the implementation — algorithm, patterns, business rules, affected layers, justification. Reference key functions; do not copy full code blocks.
- **Modelo de datos**: describe new/modified tables, columns, types, indices and FKs. Use Markdown tables when multiple columns are involved. Write `No aplica` if absent.
- **Gestión de usuarios**: describe affected roles/permissions and auth-flow changes. Write `No aplica` if absent.
- **Gestión de la configuración**: describe each new/modified parameter, its purpose, default value, and whether manual action is needed per environment. Write `No aplica` if absent.
- **Control de cambios**: populated directly from Redmine data (version, custom fields, changesets). Do not add or interpret content.
- **Pruebas**: three blocks — happy-path, negative cases (infer from visible validations), regression cases (areas touched by the change). Each case: precondition, steps, expected result. Use Markdown tables.
- Never list modified files; the repo already has change history.
- If evidence is missing, state it explicitly — never fabricate details.
