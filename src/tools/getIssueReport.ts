import { z } from "zod";
import { config } from "../config.js";
import { RedmineClient } from "../redmine/client.js";
import { getCommitInfo, getBranchInfo } from "../git/inspector.js";
import { buildReport } from "../report/builder.js";
import { writeReport } from "../report/writer.js";
import type { GitContext } from "../report/sections.js";

export const getIssueReportInputSchema = {
  issueId: z
    .number()
    .int()
    .positive()
    .describe("ID numérico de la issue en Redmine (p.ej. 1234)"),
  gitBranch: z
    .string()
    .optional()
    .describe(
      "Rama Git a analizar (por defecto usa GIT_DEFAULT_BRANCH del .env). Ignorado si se especifica gitCommit."
    ),
  gitCommit: z
    .string()
    .optional()
    .describe(
      "SHA del commit concreto a analizar. Tiene prioridad sobre gitBranch."
    ),
  includeGitContext: z
    .boolean()
    .default(true)
    .describe(
      "Incluir información del repositorio Git local en el informe. Requiere GIT_REPO_PATH válido."
    ),
  saveToFile: z
    .boolean()
    .default(true)
    .describe(
      "Guardar el informe en disco como redmine-<id>.md en REPORT_OUTPUT_DIR."
    ),
};

export const getIssueReportOutputSchema = {
  issueId: z.number().int().describe("ID de la issue"),
  subject: z.string().describe("Asunto de la issue"),
  closedOn: z.string().nullable().describe("Fecha de cierre (ISO) o null"),
  filePath: z.string().nullable().describe("Ruta del fichero generado o null si no se guardó"),
  markdownReport: z.string().describe("Informe completo en Markdown"),
};

const redmineClient = new RedmineClient(
  config.redmine.url,
  config.redmine.apiKey,
  config.redmine.tlsInsecure
);

export async function handleGetIssueReport(args: {
  issueId: number;
  gitBranch?: string;
  gitCommit?: string;
  includeGitContext: boolean;
  saveToFile: boolean;
}) {
  const { issueId, gitBranch, gitCommit, includeGitContext, saveToFile } = args;

  // 1. Fetch issue from Redmine
  const issue = await redmineClient.getIssue(issueId);

  // 2. Optionally gather Git context
  let gitContext: GitContext | undefined;
  if (includeGitContext) {
    try {
      if (gitCommit) {
        const data = await getCommitInfo(config.git.repoPath, gitCommit);
        gitContext = { type: "commit", data };
      } else {
        const branch = gitBranch ?? config.git.defaultBranch;
        const data = await getBranchInfo(config.git.repoPath, branch);
        gitContext = { type: "branch", data };
      }
    } catch (err) {
      // Git context is optional — log to stderr and continue without it
      process.stderr.write(
        `[redmine-mcp] Advertencia: no se pudo obtener el contexto Git. El informe se generará sin información Git.\n${String(err)}\n`
      );
    }
  }

  // 3. Build the Markdown report
  const markdown = buildReport(issue, gitContext);

  // 4. Optionally save to file
  let filePath: string | null = null;
  if (saveToFile) {
    filePath = writeReport(issueId, markdown, config.reportOutputDir);
  }

  return {
    content: [{ type: "text" as const, text: markdown }],
    structuredContent: {
      issueId: issue.id,
      subject: issue.subject,
      closedOn: issue.closed_on,
      filePath,
      markdownReport: markdown,
    },
  };
}
