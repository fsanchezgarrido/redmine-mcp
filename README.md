# redmine-mcp

Servidor MCP (Model Context Protocol) de **solo lectura** para consultar issues de Redmine y generar informes Markdown detallados y enriquecidos. Diseñado para usarse con **GitHub Copilot en VS Code** o **Visual Studio 2026**.

## Requisitos

- Node.js ≥ 20
- Acceso a una instancia de Redmine con API habilitada
- (Opcional) Repositorio Git local para enriquecer el análisis

## Instalación

```bash
npm install
npm run build
```

## Configuración

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

```env
# Obligatorias
REDMINE_URL=https://redmine.miempresa.com
REDMINE_API_KEY=tu_api_key_aqui

# Opcionales
GIT_DEFAULT_BRANCH=develop
GIT_REPO_PATH=C:\Code\MiProyecto
REPORT_OUTPUT_DIR=./reports
```

Para obtener tu API key: Redmine → _Mi cuenta_ → _Clave de acceso a la API_.

## Certificados TLS corporativos

Si Redmine usa un certificado firmado por una CA interna (error `UNABLE_TO_VERIFY_LEAF_SIGNATURE`):

### Opción A — `--use-system-ca` (recomendada)

Node.js 22+ puede leer el almacén de certificados de Windows, donde tu CA corporativa ya está instalada. No deshabilita la verificación TLS.

Verifica que funciona:
```bash
node --use-system-ca scripts/test-connection.mjs
```

El script `npm start` ya incluye este flag. En la configuración del MCP (VS Code / VS 2026) añade `--use-system-ca` como primer argumento:
```json
"args": ["--use-system-ca", "C:/ruta/redmine-mcp/dist/index.js"]
```

### Opción B — `REDMINE_TLS_INSECURE=true`

Deshabilita la verificación del certificado. Usar solo si la opción A no funciona:
```env
REDMINE_TLS_INSECURE=true
```

## Integración con GitHub Copilot en VS Code

### Opción A: Fichero de configuración global (`~/.copilot/mcp.json`)

Abre la paleta de comandos (`Ctrl+Shift+P`) → **MCP: Open User Configuration** y añade:

```json
{
  "servers": {
    "redmine-mcp": {
      "command": "node",
      "args": ["--use-system-ca", "C:/ruta/al/repo/redmine-mcp/dist/index.js"],
      "env": {
        "REDMINE_URL": "https://redmine.miempresa.com",
        "REDMINE_API_KEY": "tu_api_key",
        "GIT_DEFAULT_BRANCH": "develop",
        "GIT_REPO_PATH": "C:/Code/MiProyecto"
      }
    }
  }
}
```

### Opción B: Fichero de workspace (`.vscode/mcp.json`)

```json
{
  "servers": {
    "redmine-mcp": {
      "command": "node",
      "args": ["${workspaceFolder}/../redmine-mcp/dist/index.js"]
    }
  }
}
```

> Con la opción B el servidor lee el `.env` del directorio de trabajo. Asegúrate de que el `.env` está configurado.

## Integración con Visual Studio 2026

En Visual Studio 2026, abre la configuración de GitHub Copilot → **MCP Servers** → **Add Server** y completa:

- **Name:** `redmine-mcp`
- **Command:** `node`
- **Arguments:** `C:\ruta\al\repo\redmine-mcp\dist\index.js`
- **Working directory:** `C:\ruta\al\repo\redmine-mcp`

## Uso

Una vez configurado, en el chat de Copilot puedes pedir:

```
@redmine-mcp Genera el informe de la issue 1234
```

O llamar directamente a la tool:

```
Usa redmine_get_issue_report con issueId=1234
```

### Parámetros de la tool `redmine_get_issue_report`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `issueId` | number | — | **Obligatorio.** ID de la issue en Redmine |
| `gitBranch` | string | `GIT_DEFAULT_BRANCH` | Rama Git a analizar |
| `gitCommit` | string | — | SHA concreto (prioridad sobre `gitBranch`) |
| `includeGitContext` | boolean | `true` | Incluir info del repo Git local |
| `saveToFile` | boolean | `true` | Guardar informe en `REPORT_OUTPUT_DIR/redmine-<id>.md` |

## Secciones del informe generado

1. Número de issue
2. Asunto de la issue
3. Descripción (literal de Redmine)
4. Fecha de cierre
5. Análisis
6. Diseño de la solución
7. Modelo de datos
8. Gestión de usuarios
9. Gestión de la configuración
10. Control de cambios
11. Pruebas

## Smoke test con MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Abre el inspector en el navegador e invoca `redmine_get_issue_report` con un `issueId` real.
