import type { RedmineIssue, Journal, CustomField } from "../redmine/types.js";
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

/**
 * Extrae del diff unificado solo las secciones (hunks) de los ficheros
 * cuyos paths coincidan con alguno de los patrones dados.
 * Devuelve el código recortado a `maxChars`.
 */
function extractDiffHunks(diff: string, patterns: RegExp[], maxChars = 4000): string {
  if (!diff.trim()) return "";

  // Cada sección empieza con "diff --git a/..."
  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);

  const relevant = sections.filter((s) => patterns.some((p) => p.test(s)));
  if (!relevant.length) return "";

  const joined = relevant.join("\n");
  if (joined.length <= maxChars) return joined;
  return joined.slice(0, maxChars) + `\n... [recortado — ${joined.length - maxChars} caracteres adicionales] ...`;
}

/** Devuelve el diff completo sin las secciones que corresponden a patrones excluidos */
function diffExcluding(diff: string, excludePatterns: RegExp[], maxChars = 5000): string {
  if (!diff.trim()) return "";
  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const relevant = sections.filter((s) => !excludePatterns.some((p) => p.test(s)));
  if (!relevant.length) return "";
  const joined = relevant.join("\n");
  if (joined.length <= maxChars) return joined;
  return joined.slice(0, maxChars) + `\n... [recortado — ${joined.length - maxChars} caracteres adicionales] ...`;
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// Patrones para clasificar ficheros del diff
const DB_PATTERNS = [/migration/i, /\.sql\b/i, /schema/i, /seed/i, /flyway/i, /liquibase/i];
const AUTH_PATTERNS = [/\brole/i, /permission/i, /\bacl\b/i, /\bauth/i, /\bacceso/i, /\bidentity/i, /\bpolicy/i, /\bclaim/i];
const CONFIG_PATTERNS = [/appsettings/i, /\.env/i, /\bconfig\b/i, /settings/i, /\.yml$/i, /\.yaml$/i, /\.properties$/i, /web\.config/i];
const ALL_SPECIAL = [...DB_PATTERNS, ...AUTH_PATTERNS, ...CONFIG_PATTERNS];

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
  const context: string[] = [];

  const desc = issue.description?.trim();
  if (desc) {
    context.push(`**Descripción del issue:**\n${desc}`);
  }

  const notes = journalNotes(issue.journals ?? []);
  if (notes) {
    context.push(`**Historial de notas:**\n${notes}`);
  }

  if (git) {
    const commits =
      git.type === "commit"
        ? `- \`${git.data.shortSha}\` ${git.data.message} — _${git.data.author}_, ${git.data.date}`
        : git.data.recentCommits
            .map((c) => `- \`${c.shortSha}\` ${c.message} — _${c.author}_, ${c.date}`)
            .join("\n");
    if (commits) context.push(`**Commits relacionados:**\n${commits}`);
  }

  const dataBlock = context.length
    ? context.join("\n\n")
    : "_No hay datos en Redmine para esta sección._";

  return [
    `## Análisis`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    dataBlock,
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Basándote en los datos anteriores, redacta el análisis explicando:`,
    `> la **situación anterior**, el **problema o limitación detectada**, el **impacto funcional** y qué se **mejora o corrige** con esta issue.`,
    `> Si no hay datos suficientes, indícalo explícitamente.`,
    ``,
  ].join("\n");
}

// ── Diseño de la solución ──────────────────────────────────────────────────

export function sectionDesign(issue: RedmineIssue, git?: GitContext): string {
  const context: string[] = [];

  // Notas técnicas de los journals
  const techNotes = (issue.journals ?? [])
    .filter((j) => j.notes?.trim())
    .map((j) => `- **${j.user.name}** (${formatDate(j.created_on)}): ${j.notes.trim()}`);
  if (techNotes.length) {
    context.push(`**Notas del equipo:**\n${techNotes.join("\n")}`);
  }

  // Código del diff (excluyendo secciones especiales que tienen su propia sección)
  if (git?.diff) {
    const codeHunks = diffExcluding(git.diff, ALL_SPECIAL, 5000);
    if (codeHunks) {
      context.push(`**Cambios de código:**\n\`\`\`diff\n${codeHunks}\n\`\`\``);
    }
  }

  const dataBlock = context.length
    ? context.join("\n\n")
    : "_No hay datos de solución técnica disponibles._";

  return [
    `## Diseño de la solución`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    dataBlock,
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Basándote en los datos anteriores, describe:`,
    `> la **solución técnica implementada**, la **lógica aplicada**, **validaciones y reglas de negocio**,`,
    `> cambios en **frontend**, **backend** o **base de datos** si aplica, e incluye fragmentos de código relevantes.`,
    `> Explica **por qué se eligió** esta solución frente a otras opciones.`,
    ``,
  ].join("\n");
}

// ── Modelo de datos ────────────────────────────────────────────────────────

export function sectionDataModel(issue: RedmineIssue, git?: GitContext): string {
  const context: string[] = [];

  if (git?.diff) {
    const dbHunks = extractDiffHunks(git.diff, DB_PATTERNS, 4000);
    if (dbHunks) {
      context.push(`**Cambios en base de datos (migraciones / SQL / schema):**\n\`\`\`diff\n${dbHunks}\n\`\`\``);
    }
  }

  // Menciones en journals
  const dbMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["tabla", "columna", "campo", "migración", "migracion", "bbdd", "schema", "base de datos", "foreign key", "índice", "index"])
  );
  if (dbMentions.length) {
    context.push(
      `**Menciones en el seguimiento:**\n${dbMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  if (!context.length) {
    return `## Modelo de datos\n\nNo aplica\n`;
  }

  return [
    `## Modelo de datos`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    context.join("\n\n"),
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Describe los **cambios estructurales en base de datos** (tablas, columnas, índices, relaciones).`,
    `> Si solo hay metadatos o cambios menores (sin DDL), acláralos.`,
    ``,
  ].join("\n");
}

// ── Gestión de usuarios ────────────────────────────────────────────────────

export function sectionUserManagement(issue: RedmineIssue, git?: GitContext): string {
  const context: string[] = [];

  if (git?.diff) {
    const authHunks = extractDiffHunks(git.diff, AUTH_PATTERNS, 3000);
    if (authHunks) {
      context.push(`**Cambios en control de acceso / roles / permisos:**\n\`\`\`diff\n${authHunks}\n\`\`\``);
    }
  }

  const roleMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", ["rol", "role", "permiso", "permission", "acceso", "acl", "usuario", "claim", "policy"])
  );
  if (roleMentions.length) {
    context.push(
      `**Menciones en el seguimiento:**\n${roleMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  const descMention = hasKeyword(
    issue.description ?? "",
    ["rol", "role", "permiso", "permission", "acceso", "acl", "claim", "policy"]
  );
  if (descMention && !context.length) {
    context.push("_La descripción menciona aspectos de roles/permisos/accesos — ver sección Descripción._");
  }

  if (!context.length) {
    return `## Gestión de usuarios\n\nNo aplica\n`;
  }

  return [
    `## Gestión de usuarios`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    context.join("\n\n"),
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Describe el **impacto en roles, permisos o accesos** de usuario.`,
    `> Indica qué perfiles se ven afectados y cómo cambia su experiencia o capacidades.`,
    ``,
  ].join("\n");
}

// ── Gestión de la configuración ────────────────────────────────────────────

export function sectionConfigManagement(issue: RedmineIssue, git?: GitContext): string {
  const context: string[] = [];

  if (git?.diff) {
    const cfgHunks = extractDiffHunks(git.diff, CONFIG_PATTERNS, 3000);
    if (cfgHunks) {
      context.push(`**Cambios en ficheros de configuración:**\n\`\`\`diff\n${cfgHunks}\n\`\`\``);
    }
  }

  const cfgMentions = (issue.journals ?? []).filter((j) =>
    hasKeyword(j.notes ?? "", [
      "configuración", "configuracion", "config", "settings", "parámetro",
      "parametro", "variable", "appsettings", "featureflag", "feature flag",
    ])
  );
  if (cfgMentions.length) {
    context.push(
      `**Menciones en el seguimiento:**\n${cfgMentions.map((j) => `- **${j.user.name}**: ${j.notes.trim()}`).join("\n")}`
    );
  }

  if (!context.length) {
    return `## Gestión de la configuración\n\nNo aplica\n`;
  }

  return [
    `## Gestión de la configuración`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    context.join("\n\n"),
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Describe los **cambios de configuración** de la aplicación o funcionales en base de datos.`,
    `> Indica nuevos parámetros, valores por defecto y si requieren acción en los entornos (DEV/PRE/PRO).`,
    ``,
  ].join("\n");
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

  const changesets = issue.changesets ?? [];
  if (changesets.length) {
    const lines = changesets.map(
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
  const context: string[] = [];

  const desc = issue.description?.trim();
  if (desc) context.push(`**Descripción del issue:**\n${desc}`);

  const notes = journalNotes(issue.journals ?? []);
  if (notes) context.push(`**Notas del equipo:**\n${notes}`);

  // Código general (sin secciones especiales) para dar contexto de qué cambió
  if (git?.diff) {
    const codeHunks = diffExcluding(git.diff, ALL_SPECIAL, 3000);
    if (codeHunks) {
      context.push(`**Cambios de código relevantes:**\n\`\`\`diff\n${codeHunks}\n\`\`\``);
    }
  }

  const dataBlock = context.length
    ? context.join("\n\n")
    : "_No hay datos suficientes para inferir casos de prueba._";

  return [
    `## Pruebas`,
    ``,
    `<!-- DATOS DISPONIBLES -->`,
    dataBlock,
    ``,
    `<!-- INSTRUCCIÓN PARA EL AI -->`,
    `> Basándote en los datos anteriores, describe casos de prueba con **pasos claros y resultado esperado** para:`,
    `>`,
    `> **Casos positivos (happy path):** flujos principales que deben funcionar correctamente.`,
    `> **Casos negativos:** entradas inválidas, valores límite, estados incorrectos.`,
    `> **Casos de regresión:** funcionalidad preexistente que no debe verse afectada.`,
    `>`,
    `> Usa tablas Markdown o listas numeradas. Sé específico con los valores de prueba cuando el código lo permita.`,
    ``,
  ].join("\n");
}
