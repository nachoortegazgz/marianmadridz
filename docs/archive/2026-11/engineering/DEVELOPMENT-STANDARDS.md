# Estándar de desarrollo y QA — Cero deuda

**Versión consolidada:** 2026-11-14  
**Fuente:** `DIRECTRICES_DESARROLLO_CODIGO.txt` aportado por el propietario. Esta versión consolida su estándar; el archivo fuente adjunto aún no está versionado en Git.

## Objetivo

Mantener el mínimo código necesario para cumplir funcionalidad, seguridad y fiabilidad. No admitir código innecesario, alias, legacy silencioso, APIs deprecated activas, código muerto, contratos obsoletos ni placeholders que provoquen errores críticos. Las excepciones deben justificarse, tener alcance y fecha de revisión.

La documentación oficial de Wix, Wix Apps y las integraciones gobierna los contratos técnicos. Se priorizan las APIs oficiales actuales y los ejemplos documentados compatibles con el runtime del proyecto.

## 1. Definiciones operativas

### D-1. Alias

Cero alias en código productivo y pruebas. No se admiten:
- Constantes o enums duplicados que reexpongan otra SSOT con nombre distinto.
- Renombres de compatibilidad exportados.
- Rebinding local de nombres retirados.

Los consumidores deben migrarse al nombre canónico o eliminarse cuando se demuestre que están muertos.

### D-2. Legacy

Cero rutas silenciosas. No aceptar campos o formatos antiguos sin fecha de retirada, métrica de consumo o marca de auditoría.

Excepción condicionada: fallback de lectura sobre datos históricos inmutables, solo si emite warning trazable y tiene plan de migración/revisión. Un fallback de escritura o autorización es P0.

### D-3. Deprecated

Cero APIs deprecated activas en superficies exportadas. Un símbolo se consume o se elimina; no se conserva por compatibilidad. Todo cambio debe comprobar consumidores y contratos externos documentados.

### D-4. Código muerto

Cero símbolos sin consumidor verificable:
- Export sin referencias externas y sin uso interno.
- Rama lógica inalcanzable.
- Función privada nunca invocada.
- Test o runner que no forme parte de `npm test` ni de un workflow canónico.

La búsqueda de consumidores incluye todo `src/`, páginas, pruebas y runners. Los contratos externos solo se consideran consumidores si están documentados en el README del módulo.

### D-5. Obsoleto

Cero contratos zombis:
- Parámetros aceptados e ignorados.
- Estados de enum sin transición productora/consumidora.
- Comentarios o cabeceras que describan un comportamiento distinto del código.
- Versiones históricas en cabeceras que no describan el contrato vigente.

Condensar las cabeceras a responsabilidad actual, dependencias, APIs/versiones relevantes y motivo de las decisiones que deban mantenerse.

## 2. Regla anti-regresión

No eliminar símbolos, módulos, pruebas ni datos sin:
1. Búsqueda global de consumidores en `src/`, páginas, pruebas y runners.
2. Revisión de contratos externos documentados.
3. Evidencia reproducible de duplicidad, obsolescencia o ausencia de uso.
4. Cambio delimitado y diff revisado.
5. Suite pertinente y lint ejecutados sobre el mismo SHA.

No regenerar destructivamente un archivo sin comparar el diff completo con el baseline. La reducción de líneas no constituye por sí sola una mejora.

## 3. Fallbacks y deuda aceptada

Todo espejo o fallback legacy debe registrar:
- Motivo y alcance.
- Campos/formatos afectados.
- Warning o métrica trazable.
- Plan de migración.
- Fecha obligatoria `review-by`.

Sin fecha de revisión, el fallback incumple este estándar. No se permiten fallback de escritura ni de autorización.

## 4. Testing y checkpoint vigente

El checkpoint histórico de 2026-10-20 (182 pruebas) queda sustituido por el inventario de suites y workflows vigente en el repositorio.

Criterios de aceptación por intervención:
- Unitarias y hooks del módulo afectado.
- Capa 1 y Capa 2 cuando corresponda.
- Regresión offline completa.
- Contratos SDK oficiales pertinentes.
- ESLint y análisis de secretos.
- Wix Local Editor y pruebas runtime cuando el cambio dependa de comportamiento de plataforma.

Un workflow verde solo acredita las pruebas que ejecutó. No equivale a aceptación E2E del sitio publicado ni demuestra que el runtime Wix coincida con el SHA de Git.

**Recuperación de validadores:** PR #352 integrada en `main` como `c8091fd2df0ba836657032db1e2e7aa9df67758b`; CI PASS en `609ccc948da3e63d3fd8aa20f5e64c7649770660` (run #1054): Capa 1, Capa 2, regresión offline completa, SDK contracts, ESLint y Gitleaks. No se ha publicado en Wix.

**Limpieza de inventario personalizado:** PR #353 integrada en `main` como `c16ed0b605a8d548f79158aa0dbd702666eea829`; PR #354 integrada como `fde9466552b6819980475a682dc06395b57487f0`. CI PASS en `28a11a690f0a99926921332618b6af670d45814c` (run #1068) y Gitleaks PASS (run #492).

## 5. Proceso de auditoría

1. Inventariar exports, imports, llamadas, runners, scripts y workflows.
2. Clasificar cada candidato con ruta, consumidores, evidencia y sustituto verificable.
3. Ejecutar cambios mínimos por familia de símbolos/archivos.
4. Repetir búsqueda global de consumidores y ejecutar pruebas, lint y gates aplicables.
5. Revisar el diff completo y documentar riesgos y reversión.
6. Validar en Wix cuando el contrato lo requiera.
7. Publicar únicamente con autorización expresa, CI verde y estrategia de reversión.

## 6. Criterio de cierre

Cero símbolos sin consumidor, cero redundancias demostradas y cero contratos obsoletos, sin eliminar garantías de seguridad, integridad fiscal, reservas duales, idempotencia ni minimización de DTOs. La fiabilidad prevalece sobre la reducción de código.
