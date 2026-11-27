# Estado actual — 2026-11-27

**MVP operativo/comercial: NO-GO.** El sitio sigue en Draft/no publicado. Las pruebas offline de backend pasan en los HEAD de las PR integradas; Wix Runtime, Local Editor E2E y producción no están acreditados.

## Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`, rama `main`.
- HEAD: `3270a9b2b9bb95e504ed00afa88d632ebd26cad5`.
- PR #650: `transactionId` obligatorio en el writer fiscal manual; mantiene fingerprint de replay y validación del movimiento.
- PR #662: serialización canónica de fingerprints TPV; rechaza valores ambiguos/no JSON, arrays dispersos, ciclos y fechas inválidas. Merge: `94e0435f2ff8f5c4fcd68480e85a253c2c38c1b0`.
- PR #663: el guard de cierre fiscal propaga errores de Wix Data; solo WDE0073 se interpreta como registro inexistente por la DAL. Merge: `d4ce713b721aa758cdd02ed03732d6463faf5b86`.
- PR #664: centralización de timeouts, cachés, TTL de secretos y paginación fiscal en `SDK_CONFIG`; eliminación de fallbacks duplicados. Merge: `60b726de6dbcd0440dbe8092621c78e46fecea37`.
- PR #665: SHA-256/HMAC rechazan entradas vacías; el genesis hash de la cadena fiscal sigue explícito en `hashChain`. Merge: `b774e108aac03b88a359ec7e743105c97426011e`.
- PR #666: `bookingType` ausente ya no se convierte en SIMPLE; nuevas inserciones CitasF2 lo exigen y las actualizaciones de registros históricos incompletos siguen permitidas. Merge: `a34461a9c53515714243e7a7bd5be8adad24d652`.
- PR #667: `registrarEventoEconomico()` exige `transactionId` estable, lo usa para dedupe y recuperación de insert incierto, y elimina los fallbacks por secuencia/traceId. Merge: `3270a9b2b9bb95e504ed00afa88d632ebd26cad5`.

## Validación offline del último cambio

CI del HEAD de PR #667 (`abce7588f6e1af63f2284740ad4cfd8bc29e6202`): **PASS**.

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite offline completa: 84 suites / 783 tests; 0 fallos.
- Verificación SDK Wix eCommerce Cart, Transactions y TPV: PASS.
- ESLint: PASS.
- Secret scanning: PASS.
- npm audit: paso completado correctamente.

Estos resultados pertenecen al HEAD de PR validado; no acreditan por sí mismos ejecución en Wix Runtime ni publicación.

## Capa 0 — estado técnico

**Corregido e integrado:**
- Fingerprints TPV no colisionan por valores no representables.
- Los writers fiscales no interpretan indisponibilidad de CMS como periodo abierto.
- Los timeouts, cachés, TTL y límites compartidos están declarados en `SDK_CONFIG`; sus consumidores ya no duplican defaults.
- Las funciones criptográficas no devuelven un digest ficticio para entradas vacías.
- La normalización de `bookingType` conserva ausencias; las nuevas inserciones exigen valor explícito y la compatibilidad histórica de actualizaciones queda acotada.
- El writer fiscal general exige `transactionId` antes de cualquier resolución o persistencia y utiliza esa identidad para deduplicar y recuperar resultados inciertos.

**Pendiente de auditoría/corrección:**
- `secretAccess.js`: distingue actualmente secreto vacío/no disponible de forma insuficiente; revisar propagación de causa sin alterar el fail-closed de sus consumidores.
- `staff.js`: algunos fallos de Bookings Staff Members se convierten en `null`/`[]`; autorización permanece fail-closed, pero falta diferenciar ausencia real de indisponibilidad del proveedor.
- `logger.js`: ampliar pruebas de redacción para nombres compuestos, secretos y mensajes de error de proveedores; no cambiar el formato de logs sin medir impacto.
- `dataAccess.js`: revisar consumidores de `getItem()` con argumentos vacíos y normalización de resultados de `queryReferencedItems()`; distinguir ausencia legítima de contrato inválido.
- `mmUtils.js`: revisar consumidores de conversiones monetarias que devuelven cero ante entrada inválida; no cambiar hasta mapear impacto económico.
- `internalConfig.js`: revisar duplicidad semántica `TPV_RUNTIME_POLICY.CURRENCY` / `CURRENCY_CODE` y los consumidores antes de consolidar.
- Completar mapa de consumidores de todos los writers con obligación de `transactionId`, no solo los dos writers fiscales ya corregidos.

No se declara Capa 0 COMPLETADA hasta cerrar estos puntos con pruebas y revisar el diff completo.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor clásico, Velo habilitado, Draft.
- Página TPV ID `yl5th`, ruta `/tpv`, `published=false` (read-back 27-11-2026).
- Recuentos observados entonces: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`.
- No había `recordType=CONFIG_SISTEMA` ni `productionActivationAt` en los cinco MapaStaff consultados.
- Esta lectura es histórica, no una consulta live actual. No se realizaron escrituras CMS en las auditorías de Capa 0.

## Pendientes de validación superior

1. Ejecutar Wix Local Editor y Runtime E2E con fixture/sesión aislada; no reutilizar `CajaActual` ABIERTA.
2. Verificar los flujos TPV de apertura, venta, movimiento, actualización de `CajaActual` y cierre Z en Runtime.
3. Reconciliar las seis divergencias Bookings/CitasF2 con proceso backend idempotente.
4. Validar transporte Capa 3 SharePoint/Graph/Power Automate en tenant aislado.
5. Confirmar SHA/fingerprint instalado en Wix. No publicar como parte de esta intervención.

## Fuentes

- Código y pruebas: repositorio y commits enumerados.
- Wix Data `get()`: https://dev.wix.com/docs/velo/apis/wix-data/get — devuelve `null` si el ID no existe y rechaza la promesa si faltan permisos.
- Dossier y documentación especializada: `PROJECT-CANON.md`, `TPV-UNIFIED-FLOW.md`, `RELEASE-READINESS.md`, `ESQUEMA_CMS.md`.

**Criterio:** CI PASS ≠ Runtime PASS ≠ Producción verificada. Mantener el estado NO-GO hasta obtener evidencia del entorno correspondiente.
