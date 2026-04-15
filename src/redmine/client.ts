import { Agent, fetch as undiciFetch } from "undici";
import type { RedmineIssue, RedmineIssueResponse } from "./types.js";

const DEFAULT_INCLUDES = [
  "journals",
  "attachments",
  "changesets",
  "relations",
  "children",
  "watchers",
].join(",");

export class RedmineClient {
  private readonly dispatcher: Agent | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    tlsInsecure = false
  ) {
    if (tlsInsecure) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      process.stderr.write(
        "[redmine-mcp] Advertencia: REDMINE_TLS_INSECURE=true — la verificación del certificado TLS está desactivada.\n"
      );
    }
  }

  async getIssue(
    issueId: number,
    includes: string = DEFAULT_INCLUDES
  ): Promise<RedmineIssue> {
    const url = `${this.baseUrl}/issues/${issueId}.json?include=${includes}`;

    let response: Response;
    try {
      const fetchFn = this.dispatcher ? undiciFetch : fetch;
      response = (await fetchFn(url, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(this.dispatcher ? { dispatcher: this.dispatcher } as any : {}),
        headers: {
          "X-Redmine-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
      })) as Response;
    } catch (err) {
      throw new Error(
        `No se pudo conectar con Redmine (${this.baseUrl}). Verifica REDMINE_URL y la conectividad de red.\n` +
        `Si el servidor usa un certificado autofirmado, añade REDMINE_TLS_INSECURE=true al fichero .env.\n` +
        `Detalle: ${String(err)}`
      );
    }

    if (response.status === 401) {
      throw new Error(
        "Autenticación fallida (401). Verifica el valor de REDMINE_API_KEY en tu fichero .env."
      );
    }

    if (response.status === 404) {
      throw new Error(
        `Issue #${issueId} no encontrada en Redmine. Comprueba que el ID existe y que tu API key tiene acceso al proyecto.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Error de Redmine (HTTP ${response.status}). El servidor puede estar caído o en mantenimiento.`
      );
    }

    const data = (await response.json()) as RedmineIssueResponse;
    return data.issue;
  }
}
