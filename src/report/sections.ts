import type { RedmineIssue, Journal, CustomField } from "../redmine/types.js";
import type { GitBranchInfo, GitCommitInfo } from "../git/inspector.js";

export type GitContext =
  | { type: "branch"; data: GitBranchInfo }
  | { type: "commit"; data: GitCommitInfo };

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No aplica";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No aplica";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function journalNotes(journals: Journal[]): string {
  return journals
    .filter((j) => j.notes?.trim())
    .map((j) => `- **${j.user.name}** (${formatDate(j.created_on)}): ${j.notes.trim()}`)
    .join("\n");
}

function customFieldValue(fields: CustomField[] | undefined, name: string): string | null {
  if (!fields) return null;
  const f = fields.find((cf) => cf.name.toLowerCase() === name.toLowerCase());
  if (!f || f.value === null || f.value === "") return null;
  if (Array.isArray(f.value)) return f.value.join(", ") || null;
  return f.value;
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function gitFilesList(git: GitContext): string[] {
  if (git.type === "commit") return git.data.filesChanged;
  return git.data.filesChanged;
}

function gitCommitsList(git: GitContext): string {
  if (git.type === "commit") {
    const c = git.data;
    return `- \`${c.shortSha}\` ${c.message} — _${c.author}_, ${c.date}`;
  }
  return git.data.recentCommits
    .map((c) => `- \`${c.shortSha}\` ${c.message} — _${c.author}_, ${c.date}`)
    .join("\n");
}

// ── Section builders ────────────────────────────────────────────────────────

export function sectionHeader(issue: RedmineIssue): string {
  return `# Issue #${issue.id} — ${issue.subject}\n`;
}

export function sectionIssueNumber(issue: RedmineIssue): string {
  return `## Número de issue\n\n#${issue.id}\n`;
}

export function sectionSubject(issue: RedmineIssue): string {
  return `## Asunto de la issue\n\n${issue.subject}\n`;
}

export function sectionDescription(issue: RedmineIssue): string {
  const desc = issue.description?.trim() || "_Sin descripción_";
  return `## Descripción\n\n${desc}\n`;
}

export function sectionCloseDate(issue: RedmineIssue): string {
  const date = formatDate(issue.closed_on ?? issue.due_date);
  return `## Fecha de cierre\n\n${date}\n`;
}

export function sectionAnalysis(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  const desc = issue.description?.trim();
  if (desc) parts.push(`**Contexto (descripción del issue):**\n${desc}`);

  const notes = journalNotes(issue.journals ?? []);
  if (notes) parts.push(`**Notas del equipo:**\n${notes}`);

  if (git) {
    const commits = gitCommitsList(git);
    if (commits) parts.push(`**Commits relacionados:**\n${commits}`);

    const files = gitFilesList(git);
    if (files.length) {
      parts.push(`**Ficheros modificados:**\n${files.map((f) => `- \`${f}\``).join("\n")}`);
    }
  }

  const body = parts.length
    ? parts.join("\n\n")
    : "_No hay información suficiente para generar el análisis automáticamente. Completa esta sección manualmente con: situación anterior, problema detectado, limitación y su impacto funcional._";

  return `## Análisis\n\n${body}\n`;
}

export function sectionDesign(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  // Technical notes from journals
  const techNotes = (issue.journals ?? [])
    .filter((j) => j.notes?.trim() && hasKeyword(j.notes, [
      "solución", "solucion", "implementa", "fix", "corrige", "añade", "agrega",
      "modifica", "refactor", "endpoint", "api", "bbdd", "base de datos", "frontend",
      "backend", "validación", "lógica", "logic",
    ]))
    .map((j) => `- **${j.user.name}**: ${j.notes.trim()}`);
  if (techNotes.length) parts.push(`**Notas técnicas del equipo:**\n${techNotes.join("\n")}`);

  if (git) {
    const files = gitFilesList(git);
    const feFiles = files.filter((f) =>
      hasKeyword(f, ["component", "view", "page", "template", "css", "scss", ".vue", ".jsx", ".tsx", "html"])
    );
    const beFiles = files.filter((f) =>
      hasKeyword(f, ["controller", "service", "repository", "model", "api", "handler", "middleware", ".cs", ".java", ".py"])
    );
    const dbFiles = files.filter((f) =>
      hasKeyword(f, ["migration", "schema", ".sql", "seed"])
    );

    if (feFiles.length) parts.push(`**Cambios de frontend:**\n${feFiles.map((f) => `- \`${f}\``).join("\n")}`);
    if (beFiles.length) parts.push(`**Cambios de backend:**\n${beFiles.map((f) => `- \`${f}\``).join("\n")}`);
    if (dbFiles.length) parts.push(`**Cambios de base de datos:**\n${dbFiles.map((f) => `- \`${f}\``).join("\n")}`);
  }

  const body = parts.length
    ? parts.join("\n\n")
    : "_No hay información técnica suficiente para generar esta sección automáticamente. Completa con: solución técnica, lógica aplicada, validaciones, reglas y cambios de frontend/backend/BBDD._";

  return `## Diseño de la solución\n\n${body}\n`;
}

export function sectionDataModel(issue: RedmineIssue, git?: GitContext): string {
  const dbFiles = git
    ? gitFilesList(git).filter((f) =>
        hasKeyword(f, ["migration", "schema", ".sql", "seed"])
      )
    : [];

  const dbMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["tabla", "columna", "campo", "migración", "migracion", "base de datos", "bbdd", "schema"])
  );

  if (!dbFiles.length && !dbMentions.length) {
    return `## Modelo de datos\n\nNo aplica\n`;
  }

  const parts: string[] = [];
  if (dbFiles.length) {
    parts.push(`**Ficheros de base de datos detectados:**\n${dbFiles.map((f) => `- \`${f}\``).join("\n")}`);
    parts.push("_Revisa los ficheros anteriores para documentar los cambios estructurales exactos._");
  }
  if (dbMentions.length) {
    parts.push(
      `**Menciones a datos en el seguimiento:**\n${dbMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  return `## Modelo de datos\n\n${parts.join("\n\n")}\n`;
}

export function sectionUserManagement(issue: RedmineIssue, git?: GitContext): string {
  const roleFiles = git
    ? gitFilesList(git).filter((f) =>
        hasKeyword(f, ["role", "permission", "acl", "auth", "user", "access"])
      )
    : [];

  const roleMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["rol", "role", "permiso", "permission", "acceso", "acl", "usuario"])
  );

  const descMention = hasKeyword(
    issue.description ?? "",
    ["rol", "role", "permiso", "permission", "acceso", "acl", "usuario"]
  );

  if (!roleFiles.length && !roleMentions.length && !descMention) {
    return `## Gestión de usuarios\n\nNo aplica\n`;
  }

  const parts: string[] = [];
  if (descMention) {
    parts.push("_El issue menciona aspectos relacionados con roles/permisos/accesos. Revisa la descripción y completa esta sección._");
  }
  if (roleFiles.length) {
    parts.push(`**Ficheros relacionados detectados:**\n${roleFiles.map((f) => `- \`${f}\``).join("\n")}`);
  }
  if (roleMentions.length) {
    parts.push(
      `**Menciones en el seguimiento:**\n${roleMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  return `## Gestión de usuarios\n\n${parts.join("\n\n")}\n`;
}

export function sectionConfigManagement(issue: RedmineIssue, git?: GitContext): string {
  const configFiles = git
    ? gitFilesList(git).filter((f) =>
        hasKeyword(f, ["config", "appsettings", ".env", "settings", "configuration", "properties", ".yml", ".yaml", ".json"])
      )
    : [];

  const configMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["configuración", "configuracion", "config", "settings", "parámetro", "parametro", "variable"])
  );

  if (!configFiles.length && !configMentions.length) {
    return `## Gestión de la configuración\n\nNo aplica\n`;
  }

  const parts: string[] = [];
  if (configFiles.length) {
    parts.push(`**Ficheros de configuración detectados:**\n${configFiles.map((f) => `- \`${f}\``).join("\n")}`);
  }
  if (configMentions.length) {
    parts.push(
      `**Menciones en el seguimiento:**\n${configMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  return `## Gestión de la configuración\n\n${parts.join("\n\n")}\n`;
}

export function sectionChangeControl(issue: RedmineIssue): string {
  // Check fixed_version (milestone) and custom fields that may hold version info
  const versionSources: string[] = [];

  if (issue.fixed_version) {
    versionSources.push(`**Versión objetivo (Redmine):** ${issue.fixed_version.name}`);
  }

  const versionFields = ["versión", "version", "release", "control de versión", "changelog"];
  for (const field of issue.custom_fields ?? []) {
    if (versionFields.some((v) => field.name.toLowerCase().includes(v)) && field.value) {
      const val = Array.isArray(field.value) ? field.value.join(", ") : field.value;
      if (val) versionSources.push(`**${field.name}:** ${val}`);
    }
  }

  const changesets = issue.changesets ?? [];
  if (changesets.length) {
    const csLines = changesets.map(
      (cs) => `- \`${cs.revision}\` ${cs.comments} — ${formatDate(cs.committed_on)}`
    );
    versionSources.push(`**Changesets asociados:**\n${csLines.join("\n")}`);
  }

  if (!versionSources.length) {
    return `## Control de cambios\n\nNo aplica\n`;
  }

  return `## Control de cambios\n\n${versionSources.join("\n\n")}\n`;
}

export function sectionTests(issue: RedmineIssue): string {
  const subject = issue.subject;
  const desc = issue.description?.trim() ?? "";

  const positive = `### Casos positivos (happy path)

| # | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Sistema en estado normal | Ejecutar el flujo principal descrito en la issue: "${subject}" | El sistema se comporta según lo especificado |
| 2 | _Añadir casos adicionales basados en la descripción_ | … | … |`;

  const negative = `### Casos negativos

| # | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Datos inválidos o incompletos | Intentar la operación con datos fuera del rango esperado | El sistema muestra error apropiado sin excepción inesperada |
| 2 | _Añadir casos de frontera identificados en la issue_ | … | … |`;

  const regression = `### Casos de regresión

| # | Área afectada | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Funcionalidad preexistente relacionada | Verificar que las funcionalidades anteriores siguen operativas | Sin regresiones en el comportamiento previo |
| 2 | _Identificar áreas impactadas por los cambios de esta issue_ | … | … |`;

  const context = desc
    ? `> **Contexto:** ${desc.slice(0, 300)}${desc.length > 300 ? "…" : ""}`
    : "";

  return `## Pruebas\n\n${context ? context + "\n\n" : ""}${positive}\n\n${negative}\n\n${regression}\n`;
}
