# Base maestra del proyecto — Marian Madrid

**Vigencia:** 2026-11-14  
**Sitio:** https://www.marianmadrid.es/  
**Repositorio:** https://github.com/nachoortegazgz/marianmadridz  
**Plataforma confirmada:** Wix Editor Classic + Velo. No Wix Studio.  
**Autoridad:** este documento es la referencia compacta de continuidad. Ante contradicción, prevalecen las instrucciones expresas más recientes del propietario para negocio y autorización; la documentación oficial vigente de Wix/integraciones para contratos técnicos; y la evidencia live más reciente para el estado real.

## 1. Estado actual verificado

### Git
- Rama de referencia: `main`.
- HEAD verificado: `ee2a2f8aee6a00cbe3733b4b8d6325a6cb54bb51` (merge PR #357).
- PR #352–#357 integradas en `main`.
- Las últimas intervenciones #352–#357 son correcciones/limpieza y documentación; no implican publicación Wix.
- GitHub es la referencia del código versionado, no prueba del código ejecutado por Wix.

### Wix
| Entorno | Site ID | Estado | Editor | Velo | Stores | Invoices |
|---|---|---|---|---|---|---|
| Producción | `188bed94-177c-4bc9-a9f0-35080d874f3e` | Published | Editor Classic | Enabled | Catalog V3 | V1 |
| QA | `50b39f33-e753-4331-ab35-b2ed43dc97f7` | Draft | Editor Classic | Enabled | Catalog V3 | V2 |

- La diferencia Invoices V1 (producción) / V2 (QA) sigue abierta. No asumir paridad ni usar API V2 en producción.
- GetSiteContext no expone los archivos fuente Velo. **La correspondencia Wix Editor ↔ GitHub no está verificada.**
- No hay release/deployment ID que vincule el runtime publicado con un SHA de Git.
- El estado Draft y el Site ID distinto de QA no prueban aislamiento de datos, permisos, secretos, automatizaciones o integraciones.

### CMS
- Inventario live documentado: 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos.
- Wix Stores Catalog V3 es la autoridad del stock comercial. No recrear inventario custom.
- `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en el CMS live del corte (404 / WDE0025).
- `MapaStaff` es un mapa consultivo de personal/terceros/gestoría; no es autoridad RBAC.
- El diccionario CMS raíz contiene el inventario y esquema físico completo; usarlo como referencia de estructura, no como sustituto de una lectura live nueva.

### QA y publicación
- `QA_RECORD_MUTATIONS_ENABLED=true` está autorizada y activa durante desarrollo/QA.
- Update/remove individual y masivo solo para colecciones propias del proyecto; operaciones masivas requieren IDs explícitos.
- Se mantienen autenticación, autorización/RBAC, permisos, validaciones, allowlists de inserción, secretos y límites de plataforma. Colecciones Wix App excluidas.
- **Bloqueo de producción:** no publicar mientras la mutabilidad QA siga activa. Solo el propietario ordena restaurar las protecciones.
- No hay certificación E2E del runtime Wix. SharePoint/Power Automate (Capa 3) es diseño documental, no integración operativa certificada.

## 2. Necesidades y alcance funcional

La web debe apoyar la operativa del salón, no limitarse a escaparate:
1. Reservas online y gestión fiable de disponibilidad.
2. Servicios por fases con huecos de exposición y solapamiento controlado cuando el modelo de Bookings lo permita.
3. Anticipos/fianzas y cancelaciones solo tras validar el flujo fiscal, pagos, reembolsos y contratos Wix.
4. Catálogo y venta mediante Wix Stores; stock gobernado por Stores Catalog V3.
5. Área de cliente, contenidos y comunicación según capacidades nativas y consentimientos válidos.
6. Asistencia capilar automatizada solo con límites de seguridad, privacidad y supervisión profesional.
7. Registros fiscales, contables y laborales conformes con normativa aplicable, sin afirmar cumplimiento hasta validación técnica y profesional.
8. Exportación documental para gestoría y eventual archivo de evidencia en SharePoint.

**Importante:** las tablas RF/RL/RT de `NECESIDADES WEB MARIAN.txt` son requisitos declarados y criterios propuestos, no prueba de que las funciones estén implementadas, activas o legalmente certificadas. Deben revalidarse contra el CMS live, código y normativa vigente antes de planificar o aceptar una función. No reutilizar como verdad técnica sus nombres de módulos/colecciones legacy ni su referencia a Wix Studio.

## 3. Directrices de arquitectura y desarrollo

- Mejorar el sistema existente; no reconstruirlo ni introducir funciones sin necesidad demostrada.
- Wix CMS es SSOT transaccional. SharePoint es solo repositorio documental de evidencias. Capa 3 no gobierna ni modifica Capa 1.
- Frontend de presentación; lógica de negocio en backend/WebMethods.
- Centralizar constantes canónicas en `internalConfig.js`; validaciones compartidas en `validation.js`.
- Permisos y autorización siempre en backend. Nunca exponer secretos en frontend.
- Webhooks y procesos asíncronos idempotentes.
- Contratos oficiales de Wix y de cada integración prevalecen sobre ejemplos antiguos o suposiciones. Preferir SDK vigente recomendado por Wix y verificar versión/contrato antes de codificar.
- Cero alias innecesarios, APIs deprecated, legacy silencioso, código muerto, duplicidades demostradas y abstracciones prematuras.
- No retirar símbolos sin buscar consumidores en todo `src/`, revisar contratos externos/tests/runners y ejecutar la suite pertinente.
- Todo hallazgo debe incluir ruta, evidencia reproducible, impacto, propuesta y estado de validación.
- Distinguir siempre: verificado, declarado/documentado, inferido y pendiente.
- No declarar pruebas ejecutadas si no se han ejecutado. CI offline no equivale a QA Wix Runtime ni E2E.
- Cambios mínimos, commits/PR acotados, diff revisado, CI verde y plan de reversión.
- No publicar/desplegar sin autorización expresa, QA runtime adecuado, rollback y protecciones de producción restauradas.

### Integridad de registros
La política actual de QA permite temporalmente editar/eliminar registros propios por autorización expresa del propietario. Esto es una excepción temporal de QA, no una política de producción. Antes de producción debe restaurarse la inmutabilidad donde corresponda, con rectificaciones trazables en lugar de sobrescrituras/borrados de registros fiscales, contables o laborales que deban ser append-only.

## 4. Prioridades

- **P0:** integridad fiscal, seguridad crítica y pérdida de datos.
- **P1:** reservas, pagos, concurrencia, ledgers y jornada laboral.
- **P2:** integraciones, automatizaciones y exportaciones.
- **P3:** rendimiento, mantenibilidad y deuda técnica.
- **P4:** mejoras evolutivas aprobadas.

## 5. Bloqueos abiertos

1. Obtener copia/exportación reproducible del código Velo actual del Editor Classic y compararla con `main` (hashes y diff por archivo). No sobrescribir Wix ni Git a ciegas.
2. Auditar aislamiento real del sitio QA: CMS, permisos, secretos, automatizaciones, pagos y conexiones externas.
3. Resolver/confirmar la diferencia Invoices V1 producción frente a V2 QA.
4. Restaurar protecciones de mutabilidad QA y revisar gates antes de cualquier publicación.
5. Validar E2E en entorno QA seguro y vincular release Wix con SHA desplegado.
6. Verificar requisitos legales con normativa vigente y asesoría competente; no tratar la hoja de requisitos como certificación legal.
7. Mantener Capa 3 como no operativa hasta pruebas y autorización.

## 6. Fuentes de referencia — usar solo si la tarea lo requiere

- `DICCIONARIO_DATOS_CMS.md`: esquema e inventario CMS live del corte 2026-11-14.
- `ESTADO_ACTUAL_PROYECTO.md`: snapshot operativo conciso; debe permanecer alineado con esta base.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: arquitectura y contratos detallados; validar vigencia de cada sección.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: diseño de flujos Capa 3; no implica operación certificada.
- `docs/qa/2026-11-14-wix-platform-compatibility.md`: evidencia de plataforma y diferencia de apps.
- `docs/qa/2026-11-14-baseline-reconciliation.md`: evidencias de reconciliación Git/CI/CMS.
- `NECESIDADES WEB MARIAN.txt`: requisitos declarados; pendiente de revalidación y no autoritativo para estado técnico.
- `DIRECTRICES_DESARROLLO_CODIGO.txt`: directrices originales; aplicar solo los principios compatibles con esta base, ignorando snapshots de pruebas y estados históricos.

## 7. Regla de mantenimiento

Actualizar esta base únicamente cuando exista evidencia nueva o una decisión expresa del propietario. Registrar fecha, fuente y alcance del cambio. No acumular diarios de sesión, estados de PR antiguos ni bloques históricos en esta base: el historial técnico permanece en Git/PRs y los informes fechados se conservan como evidencia.
