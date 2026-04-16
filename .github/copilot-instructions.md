# Instrucciones para GitHub Copilot — Redmine MCP

## Propósito

Este repositorio es un servidor MCP que consulta issues de Redmine y proporciona su información estructurada. Cuando el usuario pida generar o completar un informe de una issue, usa la herramienta `redmine_get_issue_report`.

---

## Cómo usar la herramienta

```
redmine_get_issue_report(issueId: <número>)
```

Parámetros opcionales:
- `gitBranch`: rama Git a analizar (por defecto usa la configurada en `.env`)
- `gitCommit`: SHA de un commit concreto (tiene prioridad sobre `gitBranch`)
- `includeGitContext`: `true` por defecto — incluye código del repositorio local
- `saveToFile`: `true` por defecto — guarda el informe como `redmine-<id>.md`

Si la conexión falla, usa `redmine_ping` para diagnosticar el problema antes de continuar.

---

## Estructura del informe devuelto

La herramienta devuelve un documento Markdown con los datos en bruto de Redmine y Git agrupados por sección. **Tu tarea es analizar esos datos y generar el contenido narrativo de cada sección** según las instrucciones que se describen a continuación.

El documento sigue siempre este orden:

1. Número de issue
2. Asunto de la issue
3. Descripción _(literal de Redmine, no modificar)_
4. Fecha de cierre
5. Análisis
6. Diseño de la solución
7. Modelo de datos
8. Gestión de usuarios
9. Gestión de la configuración
10. Control de cambios
11. Pruebas

---

## Instrucciones por sección

### Análisis

Redacta una explicación de:

- **Situación anterior**: cómo funcionaba o qué existía antes del cambio.
- **Problema o limitación**: qué fallaba, qué faltaba o qué era ineficiente.
- **Impacto funcional**: a quién afectaba y cómo (usuarios, procesos, integraciones).
- **Qué se mejora o corrige**: el resultado concreto que aporta esta issue.

Basa el texto en la descripción del issue y las notas del historial. Si los commits aportan contexto sobre qué se cambió, úsalos para deducir el problema previo.

---

### Diseño de la solución

Redacta una explicación técnica de:

- **Solución implementada**: qué se hizo y cómo funciona.
- **Lógica aplicada**: algoritmo, flujo, patrones de diseño usados.
- **Validaciones y reglas de negocio**: qué restricciones se aplican y por qué.
- **Áreas afectadas**: frontend, backend, base de datos o configuración, según corresponda.
- **Por qué se eligió este enfoque**: justificación frente a alternativas.

Si hay fragmentos de código en los datos, cítalos para explicar la implementación. No copies el código entero; referencia las funciones o métodos clave y explica su propósito en una o dos frases.

---

### Modelo de datos

Si existen cambios en base de datos en los datos proporcionados:

- Describe las **tablas nuevas o modificadas**, columnas añadidas, tipos de dato, índices y claves foráneas.
- Si el cambio es solo de metadatos (comentarios, nombres de constraint, etc.) sin modificar la estructura, indícalo explícitamente.
- Usa una tabla Markdown si hay varias columnas implicadas.

Si no hay cambios de base de datos: escribe `No aplica`.

---

### Gestión de usuarios

Si hay cambios de roles, permisos o accesos:

- Indica qué **perfiles o roles** se ven afectados.
- Describe qué **acciones nuevas pueden realizar** o qué acceso se ha restringido/ampliado.
- Menciona si hay impacto en el flujo de autenticación o autorización.

Si no hay impacto en usuarios: escribe `No aplica`.

---

### Gestión de la configuración

Si hay cambios en ficheros de configuración, parámetros de aplicación o valores funcionales en base de datos:

- Describe cada **parámetro nuevo o modificado**, su propósito y valor por defecto.
- Indica si requiere acción manual en algún entorno (DEV, PRE, PRO).
- Si son feature flags, explica cuándo activarlos.

Si no hay cambios de configuración: escribe `No aplica`.

---

### Control de cambios

Esta sección se rellena directamente con los datos de Redmine (versión objetivo, custom fields de versión y changesets). No añadas ni interpretes contenido aquí; si los datos están vacíos, escribe `No aplica`.

---

### Pruebas

Redacta casos de prueba organizados en tres bloques. Para cada caso incluye: precondición, pasos y resultado esperado. Usa tablas Markdown.

**Casos positivos (happy path):**
Flujos principales que deben funcionar. Basa los casos en la funcionalidad descrita en el issue y en las funciones o métodos nuevos del código.

**Casos negativos:**
Entradas inválidas, valores límite, estados incorrectos o errores esperados que el sistema debe manejar correctamente. Infiere los casos a partir de las validaciones visibles en el código.

**Casos de regresión:**
Funcionalidad preexistente relacionada que no debe verse afectada. Identifica las áreas tocadas por el cambio y propón verificaciones de que siguen funcionando.

---

## Normas generales

- Redacta en **español**, en tercera persona, con tono técnico y conciso.
- No repitas literalmente la descripción del issue; sintetiza e interpreta.
- Si una sección no tiene datos suficientes para generar contenido, escribe `No aplica` o una nota breve indicando qué información falta.
- No incluyas listas de ficheros modificados; el repositorio ya tiene el histórico de cambios.
- El informe final debe poder entenderse sin acceso a Redmine ni al repositorio.
- Si falta evidencia técnica, indícalo explícitamente y no inventes detalles.
- Mantén coherencia entre `Analisis`, `Diseno de la solucion` y `Pruebas`.


