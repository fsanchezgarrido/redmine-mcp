import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getIssueReportInputSchema,
  getIssueReportOutputSchema,
  handleGetIssueReport,
} from "./getIssueReport.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "redmine_get_issue_report",
    {
      title: "Obtener informe de issue Redmine",
      description:
        "Lee una issue de Redmine por ID y genera un informe detallado en Markdown con secciones de análisis, diseño de solución, modelo de datos, gestión de usuarios, control de cambios y casos de prueba. Opcionalmente enriquece el informe con información del repositorio Git local.",
      inputSchema: getIssueReportInputSchema,
      outputSchema: getIssueReportOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handleGetIssueReport
  );
}
