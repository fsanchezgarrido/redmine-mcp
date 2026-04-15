/**
 * Script de diagnóstico de conectividad con Redmine.
 * Uso: node scripts/test-connection.mjs
 *
 * Carga el .env automáticamente y prueba la conexión.
 */
import { Agent, fetch as undiciFetch } from "undici";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

// Carga manual del .env (sin dependencia de dotenv en el script)
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} else {
  console.warn("⚠️  No se encontró .env, usando variables de entorno del sistema.");
}

const REDMINE_URL = (process.env.REDMINE_URL ?? "").replace(/\/$/, "");
const REDMINE_API_KEY = process.env.REDMINE_API_KEY ?? "";
const TLS_INSECURE = process.env.REDMINE_TLS_INSECURE === "true" || process.env.REDMINE_TLS_INSECURE === "1";

console.log("=".repeat(60));
console.log("  Diagnóstico de conexión Redmine MCP");
console.log("=".repeat(60));
console.log(`  URL:            ${REDMINE_URL || "(no configurada)"}`);
console.log(`  API Key:        ${REDMINE_API_KEY ? REDMINE_API_KEY.slice(0, 4) + "****" : "(no configurada)"}`);
console.log(`  TLS Insecure:   ${TLS_INSECURE}`);
console.log("=".repeat(60));

if (!REDMINE_URL) {
  console.error("\n❌ REDMINE_URL no está configurada en el .env");
  process.exit(1);
}

const dispatcher = TLS_INSECURE
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : undefined;

async function testUrl(label, url, headers) {
  console.log(`\n🔍 Probando ${label}:`);
  console.log(`   ${url}`);
  const t0 = Date.now();
  try {
    const res = await (dispatcher ? undiciFetch : fetch)(url, {
      ...(dispatcher ? { dispatcher } : {}),
      headers,
    });
    const ms = Date.now() - t0;
    console.log(`   ✅ HTTP ${res.status} ${res.statusText} (${ms} ms)`);
    return { ok: true, status: res.status };
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`   ❌ Error (${ms} ms)`);
    let e = err;
    let depth = 0;
    while (e && depth < 5) {
      const code = e.code ? ` [${e.code}]` : "";
      console.log(`      ${depth === 0 ? "error" : "causa"}:  ${e.name}: ${e.message}${code}`);
      e = e.cause;
      depth++;
    }
    return { ok: false, error: err };
  }
}

// Test 1: conexión básica sin autenticación
await testUrl(
  "Redmine sin auth (prueba de red/TLS)",
  `${REDMINE_URL}/`,
  { "Content-Type": "application/json" }
);

// Test 2: endpoint de issues con API key
await testUrl(
  "Redmine con API key (/issues.json?limit=1)",
  `${REDMINE_URL}/issues.json?limit=1`,
  { "X-Redmine-API-Key": REDMINE_API_KEY, "Content-Type": "application/json" }
);

console.log("\n" + "=".repeat(60));
console.log("  Sugerencias:");
console.log("  - UNABLE_TO_VERIFY / certificate");
console.log("    → Opción A (recomendada): relanza con --use-system-ca");
console.log("      node --use-system-ca scripts/test-connection.mjs");
console.log("      Usa la CA corporativa de Windows sin deshabilitar TLS.");
console.log("    → Opción B (rápida): añade REDMINE_TLS_INSECURE=true al .env");
console.log("  - Error ENOTFOUND        → DNS no resuelve el host, comprueba VPN/red");
console.log("  - Error ECONNREFUSED     → puerto cerrado o path de URL incorrecto");
console.log("  - Error ETIMEDOUT        → firewall o servidor caído");
console.log("  - HTTP 401               → API key incorrecta");
console.log("  - HTTP 404               → la URL base no apunta a Redmine");
console.log("=".repeat(60) + "\n");
