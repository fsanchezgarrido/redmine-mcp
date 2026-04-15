import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getIssueReportInputSchema,
  getIssueReportOutputSchema,
  handleGetIssueReport,
} from "./getIssueReport.js";
import { pingOutputSchema, handlePing } from "./ping.js";

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

  server.registerTool(
    "redmine_ping",
    {
      title: "Diagnóstico de conexión Redmine",
      description:
        "Comprueba la conectividad con el servidor Redmine configurado y devuelve un diagnóstico detallado. Útil para depurar problemas de red, TLS o autenticación.",
      inputSchema: {},
      outputSchema: pingOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    handlePing
  );
}
