import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const envSchema = z.object({
  REDMINE_URL: z.string().url("REDMINE_URL debe ser una URL válida (ej: https://redmine.miempresa.com)"),
  REDMINE_API_KEY: z.string().min(1, "REDMINE_API_KEY es obligatoria"),
  REDMINE_TLS_INSECURE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  GIT_DEFAULT_BRANCH: z.string().min(1).default("develop"),
  GIT_REPO_PATH: z.string().default(process.cwd()),
  REPORT_OUTPUT_DIR: z.string().default("./reports"),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${String(i.path.join("."))}: ${i.message}`)
      .join("\n");
    process.stderr.write(
      `[redmine-mcp] Error de configuración. Comprueba tu fichero .env:\n${issues}\n`
    );
    process.exit(1);
  }

  // result.success is true here — data is defined
  const data = result.data!;
  return {
    redmine: {
      url: data.REDMINE_URL.replace(/\/$/, ""),
      apiKey: data.REDMINE_API_KEY,
      tlsInsecure: data.REDMINE_TLS_INSECURE ?? false,
    },
    git: {
      defaultBranch: data.GIT_DEFAULT_BRANCH,
      repoPath: path.resolve(data.GIT_REPO_PATH),
    },
    reportOutputDir: path.resolve(data.REPORT_OUTPUT_DIR),
  };
}

export const config = loadConfig();
export type Config = typeof config;
