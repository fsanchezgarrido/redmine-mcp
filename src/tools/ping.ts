import { z } from "zod";
import { config } from "../config.js";
import { RedmineClient } from "../redmine/client.js";

export const pingOutputSchema = {
  ok: z.boolean().describe("true si se pudo conectar con Redmine"),
  url: z.string().describe("URL probada"),
  statusCode: z.number().optional().describe("Código HTTP recibido"),
  statusText: z.string().optional().describe("Texto del estado HTTP"),
  tlsInsecure: z.boolean().describe("Si se usó modo TLS sin verificación"),
  errorDetail: z.string().optional().describe("Descripción detallada del error si ok=false"),
  durationMs: z.number().describe("Tiempo de respuesta en milisegundos"),
  diagnosis: z.string().describe("Diagnóstico legible con sugerencias de acción"),
};

const redmineClient = new RedmineClient(
  config.redmine.url,
  config.redmine.apiKey,
  config.redmine.tlsInsecure
);

export async function handlePing() {
  const result = await redmineClient.testConnectivity();

  let diagnosis: string;

  if (result.ok) {
    if (result.statusCode === 401) {
      diagnosis =
        "Conexión OK, pero la API key es incorrecta o no tiene permisos. " +
        "Verifica REDMINE_API_KEY en el fichero .env.";
    } else {
      diagnosis = `Conexión correcta con Redmine (HTTP ${result.statusCode}). La configuración es válida.`;
    }
  } else {
    const detail = result.errorDetail ?? "";

    if (detail.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE") ||
        detail.includes("SELF_SIGNED_CERT") ||
        detail.includes("ERR_TLS") ||
        detail.includes("certificate")) {
      diagnosis =
        "Error de certificado TLS. " +
        (result.tlsInsecure
          ? "REDMINE_TLS_INSECURE=true está activo pero sigue fallando. El error puede ser de red o de host no resolvible."
          : "Añade REDMINE_TLS_INSECURE=true al fichero .env para omitir la verificación del certificado.");
    } else if (detail.includes("ENOTFOUND") || detail.includes("getaddrinfo")) {
      diagnosis =
        `DNS no resuelve el host "${config.redmine.url}". ` +
        "Comprueba que REDMINE_URL es correcto y que tienes acceso a la red/VPN necesaria.";
    } else if (detail.includes("ECONNREFUSED")) {
      diagnosis =
        "Conexión rechazada. El servidor no está escuchando en ese puerto o la URL es incorrecta. " +
        "Verifica REDMINE_URL (incluyendo el path /redmine si aplica).";
    } else if (detail.includes("ETIMEDOUT") || detail.includes("ECONNRESET") || detail.includes("socket hang up")) {
      diagnosis =
        "Timeout o conexión cortada. El servidor puede estar caído, bloqueado por firewall, o necesitas estar en la VPN.";
    } else if (detail.includes("ERR_INVALID_URL") || detail.includes("Invalid URL")) {
      diagnosis = "La URL configurada en REDMINE_URL no es válida. Revisa su formato.";
    } else {
      diagnosis =
        "Error de conexión desconocido. Revisa el campo errorDetail para más información.";
    }
  }

  const structured = { ...result, diagnosis };

  const lines = [
    `## Diagnóstico de conexión Redmine`,
    ``,
    `- **URL probada:** \`${result.url}\``,
    `- **Estado:** ${result.ok ? "✅ Conectado" : "❌ Error"}`,
    result.statusCode != null ? `- **HTTP:** ${result.statusCode} ${result.statusText ?? ""}` : null,
    `- **TLS inseguro:** ${result.tlsInsecure ? "sí (REDMINE_TLS_INSECURE=true)" : "no"}`,
    `- **Tiempo:** ${result.durationMs} ms`,
    ``,
    `### Diagnóstico`,
    ``,
    diagnosis,
    result.errorDetail
      ? `\n### Detalle del error\n\n\`\`\`\n${result.errorDetail}\n\`\`\``
      : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    content: [{ type: "text" as const, text: lines }],
    structuredContent: structured,
  };
}
