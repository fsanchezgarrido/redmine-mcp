import type { RedmineIssue, Journal } from "../redmine/types.js";
import type { GitContext } from "../git/inspector.js";

export type { GitContext };

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

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// Extensión → lenguaje para bloques de código
const EXT_LANG: Record<string, string> = {
  cs: "csharp", ts: "typescript", js: "javascript", tsx: "tsx", jsx: "jsx",
  py: "python", java: "java", rb: "ruby", go: "go", cpp: "cpp", c: "c",
  sql: "sql", xml: "xml", json: "json", yml: "yaml", yaml: "yaml",
  html: "html", css: "css", scss: "scss", sh: "bash", ps1: "powershell",
};

function langFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? ext;
}

// Patrones para clasificar secciones del diff por nombre de fichero
const DB_PATTERNS      = [/migration/i, /\.sql\b/i, /\bschema\b/i, /seed/i, /flyway/i, /liquibase/i];
const AUTH_PATTERNS    = [/\brole/i, /permission/i, /\bacl\b/i, /\bauth/i, /\bidentity/i, /\bpolicy/i, /\bclaim/i];
const CONFIG_PATTERNS  = [/appsettings/i, /\.env/i, /\bconfig\b/i, /\bsettings\b/i, /\.ya?ml$/i, /\.properties$/i, /web\.config/i];
const ALL_SPECIAL      = [...DB_PATTERNS, ...AUTH_PATTERNS, ...CONFIG_PATTERNS];

/**
 * Extrae las líneas **añadidas** (`+`) del diff para los ficheros que coincidan
 * con algún patrón. Devuelve bloques de código agrupados por fichero.
 * maxLinesPerFile y maxFiles limitan el tamaño total.
 */
function extractNewCode(
  diff: string,
  matchPatterns: RegExp[],
  maxLinesPerFile = 25,
  maxFiles = 4
): string {
  if (!diff.trim()) return "";

  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);

  const relevant = matchPatterns.length
    ? sections.filter((s) => matchPatterns.some((p) => p.test(s)))
    : sections;

  const snippets: string[] = [];

  for (const section of relevant.slice(0, maxFiles)) {
    const fileMatch = section.match(/^diff --git a\/(.+?) b\//m);
    const filePath = fileMatch?.[1] ?? "unknown";

    const addedLines = section
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1))
      .filter((l) => l.trim().length > 0); // omit blank added lines

    if (!addedLines.length) continue;

    const shown = addedLines.slice(0, maxLinesPerFile);
    const omitted = addedLines.length - shown.length;
    const lang = langFromPath(filePath);
    const omittedNote = omitted > 0 ? `\n// ... ${omitted} líneas adicionales omitidas` : "";

    snippets.push(
      `**\`${filePath}\`**\n\`\`\`${lang}\n${shown.join("\n")}${omittedNote}\n\`\`\``
    );
  }

  const remaining = relevant.length - Math.min(relevant.length, maxFiles);
  if (remaining > 0) {
    snippets.push(`_... y ${remaining} fichero(s) adicional(es) con cambios._`);
  }

  return snippets.join("\n\n");
}

/** Mismo que extractNewCode pero excluye los ficheros especiales */
function extractNewCodeGeneral(diff: string, maxLinesPerFile = 25, maxFiles = 5): string {
  if (!diff.trim()) return "";
  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const general = sections.filter((s) => !ALL_SPECIAL.some((p) => p.test(s)));
  // Reutilizamos la lógica pasando el diff ya filtrado
  const filtered = general.join("\n");
  return extractNewCode(filtered, [], maxLinesPerFile, maxFiles);
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

// ── Análisis ───────────────────────────────────────────────────────────────

export function sectionAnalysis(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  const desc = issue.description?.trim();
  if (desc) parts.push(`**Descripción:**\n${desc}`);

  const notes = journalNotes(issue.journals ?? []);
  if (notes) parts.push(`**Historial de notas:**\n${notes}`);

  if (git) {
    const commits =
      git.type === "commit"
        ? `- \`${git.data.shortSha}\` ${git.data.message} — _${git.data.author}_, ${git.data.date}`
        : git.data.recentCommits
            .map((c) => `- \`${c.shortSha}\` ${c.message} — _${c.author}_, ${c.date}`)
            .join("\n");
    if (commits) parts.push(`**Commits relacionados:**\n${commits}`);
  }

  const context = parts.length
    ? parts.join("\n\n")
    : "_Sin datos disponibles en Redmine para esta sección._";

  return `## Análisis\n\n${context}\n`;
}

// ── Diseño de la solución ──────────────────────────────────────────────────

export function sectionDesign(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  const notes = journalNotes(issue.journals ?? []);
  if (notes) parts.push(`**Notas del equipo:**\n${notes}`);

  if (git?.diff) {
    const code = extractNewCodeGeneral(git.diff, 25, 5);
    if (code) parts.push(`**Nuevas implementaciones relevantes:**\n\n${code}`);
  }

  const context = parts.length
    ? parts.join("\n\n")
    : "_Sin notas técnicas ni cambios de código disponibles._";

  return `## Diseño de la solución\n\n${context}\n`;
}

// ── Modelo de datos ────────────────────────────────────────────────────────

export function sectionDataModel(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  if (git?.diff) {
    const code = extractNewCode(git.diff, DB_PATTERNS, 30, 4);
    if (code) parts.push(`**Cambios en base de datos:**\n\n${code}`);
  }

  const dbMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["tabla", "columna", "campo", "migración", "migracion", "bbdd", "schema", "base de datos", "foreign key", "índice", "index"])
  );
  if (dbMentions.length) {
    parts.push(
      `**Menciones en el seguimiento:**\n${dbMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  if (!parts.length) {
    return `## Modelo de datos\n\nNo aplica\n`;
  }

  return `## Modelo de datos\n\n${parts.join("\n\n")}\n`;
}

// ── Gestión de usuarios ────────────────────────────────────────────────────

export function sectionUserManagement(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  if (git?.diff) {
    const code = extractNewCode(git.diff, AUTH_PATTERNS, 20, 3);
    if (code) parts.push(`**Cambios en control de acceso:**\n\n${code}`);
  }

  const roleMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["rol", "role", "permiso", "permission", "acceso", "acl", "usuario", "claim", "policy"])
  );
  if (roleMentions.length) {
    parts.push(
      `**Menciones en el seguimiento:**\n${roleMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  const descMention = hasKeyword(
    issue.description ?? "",
    ["rol", "role", "permiso", "permission", "acceso", "acl", "claim", "policy"]
  );
  if (descMention && !parts.length) {
    parts.push("_La descripción menciona aspectos de roles/permisos — ver sección Descripción._");
  }

  if (!parts.length) {
    return `## Gestión de usuarios\n\nNo aplica\n`;
  }

  return `## Gestión de usuarios\n\n${parts.join("\n\n")}\n`;
}

// ── Gestión de la configuración ────────────────────────────────────────────

export function sectionConfigManagement(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  if (git?.diff) {
    const code = extractNewCode(git.diff, CONFIG_PATTERNS, 20, 3);
    if (code) parts.push(`**Cambios de configuración:**\n\n${code}`);
  }

  const cfgMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", [
      "configuración", "configuracion", "config", "settings", "parámetro",
      "parametro", "variable", "appsettings", "feature flag",
    ])
  );
  if (cfgMentions.length) {
    parts.push(
      `**Menciones en el seguimiento:**\n${cfgMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  if (!parts.length) {
    return `## Gestión de la configuración\n\nNo aplica\n`;
  }

  return `## Gestión de la configuración\n\n${parts.join("\n\n")}\n`;
}

// ── Control de cambios ─────────────────────────────────────────────────────

export function sectionChangeControl(issue: RedmineIssue): string {
  const parts: string[] = [];

  if (issue.fixed_version) {
    parts.push(`**Versión objetivo:** ${issue.fixed_version.name}`);
  }

  const versionKeywords = ["versión", "version", "release", "control de versión", "changelog", "entregable"];
  for (const field of issue.custom_fields ?? []) {
    if (versionKeywords.some((v) => field.name.toLowerCase().includes(v)) && field.value) {
      const val = Array.isArray(field.value) ? field.value.join(", ") : field.value;
      if (val) parts.push(`**${field.name}:** ${val}`);
    }
  }

  if (issue.changesets?.length) {
    const lines = issue.changesets.map(
      (cs) => `- \`${cs.revision}\` ${cs.comments} — ${formatDate(cs.committed_on)}`
    );
    parts.push(`**Changesets en Redmine:**\n${lines.join("\n")}`);
  }

  if (!parts.length) {
    return `## Control de cambios\n\nNo aplica\n`;
  }

  return `## Control de cambios\n\n${parts.join("\n\n")}\n`;
}

// ── Pruebas ────────────────────────────────────────────────────────────────

export function sectionTests(issue: RedmineIssue, git?: GitContext): string {
  const parts: string[] = [];

  const desc = issue.description?.trim();
  if (desc) parts.push(`**Descripción del issue:**\n${desc}`);

  const notes = journalNotes(issue.journals ?? []);
  if (notes) parts.push(`**Notas del equipo:**\n${notes}`);

  // Solo firmas/funciones nuevas relevantes para inferir casos de prueba
  if (git?.diff) {
    const code = extractNewCodeGeneral(git.diff, 15, 3);
    if (code) parts.push(`**Funciones/métodos nuevos:**\n\n${code}`);
  }

  const context = parts.length
    ? parts.join("\n\n")
    : "_Sin datos suficientes para inferir casos de prueba._";

  return `## Pruebas\n\n${context}\n`;
}
