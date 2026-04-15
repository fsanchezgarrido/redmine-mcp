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

/** Extrae el mensaje de error más útil de un error de fetch/undici */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const lines: string[] = [`${err.name}: ${err.message}`];

  // undici envuelve el error real en `cause`
  let cause: unknown = (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
  let depth = 0;
  while (cause && depth < 4) {
    if (cause instanceof Error) {
      const e = cause as NodeJS.ErrnoException;
      lines.push(`  causa: ${e.name}: ${e.message}${e.code ? ` [${e.code}]` : ""}`);
      cause = (e as { cause?: unknown }).cause;
    } else {
      lines.push(`  causa: ${String(cause)}`);
      break;
    }
    depth++;
  }
  return lines.join("\n");
}

export interface ConnectivityResult {
  ok: boolean;
  url: string;
  statusCode?: number;
  statusText?: string;
  tlsInsecure: boolean;
  errorDetail?: string;
  durationMs: number;
}

export class RedmineClient {
  private readonly dispatcher: Agent | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly tlsInsecure = false
  ) {
    if (tlsInsecure) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      process.stderr.write(
        "[redmine-mcp] Advertencia: REDMINE_TLS_INSECURE=true — la verificación del certificado TLS está desactivada.\n"
      );
    }
  }

  private async doFetch(url: string, headers: Record<string, string>): Promise<Response> {
    const fetchFn = this.dispatcher ? undiciFetch : fetch;
    return (await fetchFn(url, {
      // undici dispatcher para TLS insecure
      ...(this.dispatcher ? { dispatcher: this.dispatcher } as object : {}),
      headers,
    })) as Response;
  }

  /** Comprueba conectividad con Redmine sin necesitar un issue ID real */
  async testConnectivity(): Promise<ConnectivityResult> {
    // Usamos /issues.json?limit=1 — devuelve 200/401 según credenciales, pero confirma acceso HTTP
    const url = `${this.baseUrl}/issues.json?limit=1`;
    const t0 = Date.now();

    try {
      const response = await this.doFetch(url, {
        "X-Redmine-API-Key": this.apiKey,
        "Content-Type": "application/json",
      });
      return {
        ok: response.ok || response.status === 401, // 401 = llega a Redmine, solo falla auth
        url,
        statusCode: response.status,
        statusText: response.statusText,
        tlsInsecure: this.tlsInsecure,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        ok: false,
        url,
        tlsInsecure: this.tlsInsecure,
        errorDetail: describeFetchError(err),
        durationMs: Date.now() - t0,
      };
    }
  }

  async getIssue(
    issueId: number,
    includes: string = DEFAULT_INCLUDES
  ): Promise<RedmineIssue> {
    const url = `${this.baseUrl}/issues/${issueId}.json?include=${includes}`;

    let response: Response;
    try {
      response = await this.doFetch(url, {
        "X-Redmine-API-Key": this.apiKey,
        "Content-Type": "application/json",
      });
    } catch (err) {
      const detail = describeFetchError(err);
      throw new Error(
        `No se pudo conectar con Redmine (${this.baseUrl}).\n` +
        `Si el servidor usa certificado autofirmado o de CA privada, añade REDMINE_TLS_INSECURE=true al .env.\n` +
        `Detalle:\n${detail}`
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
        `Error de Redmine (HTTP ${response.status} ${response.statusText}). El servidor puede estar caído o en mantenimiento.`
      );
    }

    const data = (await response.json()) as RedmineIssueResponse;
    return data.issue;
  }
}
