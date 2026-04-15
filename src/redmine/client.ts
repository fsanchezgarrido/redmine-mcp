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
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async getIssue(
    issueId: number,
    includes: string = DEFAULT_INCLUDES
  ): Promise<RedmineIssue> {
    const url = `${this.baseUrl}/issues/${issueId}.json?include=${includes}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "X-Redmine-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      throw new Error(
        `No se pudo conectar con Redmine (${this.baseUrl}). Verifica REDMINE_URL y la conectividad de red.\nDetalle: ${String(err)}`
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
