# Aceptación MVP — revalidación Wix Runtime read-only — 2026-11-27

## Resultado ejecutivo

**Estado global: NO-GO MVP operativo.** La lectura real de APIs Wix está funcionando, pero ha detectado una divergencia crítica entre el estado nativo de Bookings y la proyección CMS. Los contratos de código y CI offline no sustituyen la ejecución de los flujos Velo en Wix Preview/Runtime.

Alcance de esta ejecución: Site Context, CMS Data Items, Bookings Reader V2 y Automations V2, todos en solo lectura. No se crearon ni modificaron reservas, sesiones de caja, movimientos, fichajes, configuración fiscal, automatizaciones, pedidos, pagos ni documentos externos.

## 1. Entorno Wix

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- GetSiteContext devuelve **Draft**, `published=false`; Editor clásico, Velo habilitado, Premium, EUR y `Europe/Madrid`.
- 9 páginas estáticas y 2 dinámicas; la TPV corresponde al ID `yl5th`, ruta `/blank`.
- Apps instaladas: Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Payments, Stores Catalog V3, Blog y SEO.
- La lectura no demuestra que el `main` actual esté sincronizado con el Editor/Draft ni que la versión pública coincida con el repositorio.

## 2. Bookings: EVIDENCIA DE FALLO FUNCIONAL

Consulta de `CitasF2` (11 filas) y consulta de Bookings Reader V2 por los 11 `bookingId`:

| Resultado | Cantidad |
|---|---:|
| IDs de CMS existentes también en Bookings V2 | 11/11 |
| CMS CONFIRMED y nativo CONFIRMED | 5 |
| CMS CONFIRMED/PENDING y nativo CANCELED | 6 |
| CMS sin booking nativo | 0 |

Los seis estados divergentes son:
- `b18337da-2326-46fc-89c0-1843b6be0730`: CMS CONFIRMED / nativo CANCELED.
- `f137c63a-f704-461e-91bc-3295e853c67d`: CMS CONFIRMED / nativo CANCELED.
- `130c2b6c-ea4a-4dd2-a670-75fd6b7a6c30`: CMS PENDING / nativo CANCELED.
- `6793e96e-7e24-4128-831d-a70d82506d5b`: CMS CONFIRMED / nativo CANCELED.
- `13c74dc7-b6fd-4c04-b6cf-a516c9e019e8`: CMS CONFIRMED / nativo CANCELED.
- `d813afa4-6769-469a-8106-a7d19b1c954f`: CMS CONFIRMED / nativo CANCELED.

En `ControlOperativo` (78 filas) no se encontró marcador `BOOKING_CANCELED` en los payloads inspeccionados. El handler está presente y exportado en `src/backend/events.js`, pero el runtime no ha dejado evidencia de entrega/procesamiento para estas cancelaciones.

**Impacto:** la proyección propia puede presentar como activas reservas que Wix Bookings ya canceló. No se debe recrear ni reconfirmar ninguna reserva.

**Acción necesaria:** implementar/ejecutar reconciliación backend controlada que lea el estado nativo, actualice solo la proyección `CitasF2` con auditoría e idempotencia y vuelva a comparar los 11 IDs. No actualizar CMS por REST ni fabricar eventos. Seguimiento issue #523.

## 3. Caja, TPV y fiscalidad — bloqueados correctamente

Read-back CMS actual:

| Colección | Registros | Resultado |
|---|---:|---|
| `CajaActual` | 1 | `ABIERTA` |
| `MovimientosCaja` | 5 | 5 `SIMULATED_SUCCESS` |
| `HistoricoCierresZ` | 1 | `SIMULATED` |
| `TransaccionesTPV` | 0 | Sin intenciones comerciales |
| `ControlOperativo` | 78 | 3 compensaciones pendientes |
| `MapaStaff` | 5 | 1 GESTORIA, 1 TERCERO, 3 STAFF |
| `RegistrosHorariosStaff` | 0 | Sin fichajes |
| `CitasF2` | 11 | Divergencia detallada arriba |

Las tres compensaciones de `ControlOperativo` son `FISCAL_LEDGER/PENDING_RECOVERY`, con `attempts=0`. Una conserva `ORIGINAL_ORDER_LEDGER_MISSING`; dos reflejan que el writer fiscal sigue deshabilitado.

No existe `recordType=CONFIG_SISTEMA` ni `CONFIG_SISTEMA_FISCAL` en `MapaStaff`; ninguno de los cinco registros contiene `productionActivationAt`. `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false` y `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` continúan cerrados en el código leído.

**Decisión:** no usar la caja abierta ni las compensaciones como fixture. No ejecutar apertura/cierre, movimientos, ventas, devoluciones, fichajes, recovery fiscal ni reset de datos. El sistema está fail-closed; eso es protección, no aceptación funcional.

## 4. Automatizaciones y riesgo de efectos externos

Query Automations V2 paginada:
- 159 automatizaciones totales.
- 7 en estado ACTIVE.
- Get Automation individual confirmó que las 7 son `PREINSTALLED` y tienen `settings.disableStatusChange=true`.
- No aparece ninguna automatización ACTIVE de origen APPLICATION en el inventario actual.

Los triggers activos corresponden a guardado de tarjeta, tareas de agente, notificación Aria, confirmación de email de miembros, confirmación de suscripción, aviso de límite CMS y restablecimiento de contraseña.

No se ejecutaron ni modificaron automatizaciones. Las preinstaladas no pueden desactivarse mediante la vía soportada consultada. No ejecutar pruebas que puedan disparar estos eventos sin aislamiento demostrado.

## 5. Concurrencia CajaActual

El código actual de `main` contiene la corrección integrada por PR #528:
- `_updateCajaActual` adquiere `acquireFiscalLedgerLock` cuando no recibe lock compartido.
- `eventLog.js` reutiliza el lock del writer.
- `events.js` usa el helper que adquiere el lock común.
- `tpvRepository.js` también utiliza `acquireFiscalLedgerLock` para la proyección.
- Existen pruebas offline de locking/proyección; PR #528 tuvo CI offline y secret scanning PASS (runs 45021242129 / 45021242143).

**No probado:** concurrencia real en Wix Runtime, persistencia simultánea con dos operaciones reales de prueba, recuperación tras timeout, y sincronización del SHA instalado. Issue #525 sigue abierta.

## 6. Capa 3 y dependencias

- PR #641 integra `prepareExternalRegistryPackage`, contrato trimestral determinista, checksum SHA-256, minimización de campos y lectura estricta de registros REAL.
- El servicio prepara un paquete en memoria; no escribe CMS, no entrega SharePoint, no llama Graph ni Power Automate.
- Sin configuración fiscal ni `productionActivationAt`, la exportación fiscal real debe fallar cerrada.
- No hay evidencia Runtime del WebMethod ni transporte externo E2E.

## 7. Checklist de aceptación verificable

| Criterio | Estado | Evidencia |
|---|---|---|
| Wix Site Context y estructura consultables | PASS — lectura | GetSiteContext + páginas |
| CMS consultable en runtime Wix | PASS — lectura | Query Data Items, recuentos actuales |
| Bookings nativo consultable | PASS — lectura | Bookings Reader V2, 11/11 IDs |
| Coherencia CitasF2 ↔ Bookings | FAIL | 6/11 divergentes |
| Automatizaciones inventariadas | PASS — metadatos | 159 total, 7 ACTIVE bloqueadas |
| Caja segura para QA | BLOCKED | Singleton existente ABIERTA |
| Writer TPV funcional | BLOCKED | 0 TransaccionesTPV; gates y runtime sin validar |
| Concurrencia CajaActual | PARTIAL | Código + CI offline; Runtime pendiente |
| Configuración fiscal | BLOCKED | Falta CONFIG_SISTEMA y corte |
| Writer fiscal/contable | BLOCKED | Flags fail-closed; 3 compensaciones pendientes |
| Jornada laboral | BLOCKED | 0 fichajes y writer deshabilitado |
| Exportación Capa 3 | PARTIAL | Contrato offline; sin transporte ni runtime |
| Wix UI E2E | NOT RUN | No se dispone aquí de runner/browser autenticado ni workflow dispatch |
| Código main sincronizado con Wix Draft | NOT VERIFIED | No se leyó fingerprint de build desde Preview |

### Qué se ha probado realmente

- **PASS runtime de API read-only:** llamadas autenticadas a CMS, Bookings Reader V2 y Automations V2 devolvieron datos actuales.
- **FAIL funcional de proyección:** 6 reservas nativas canceladas continúan como CONFIRMED/PENDING en CitasF2.
- **PASS histórico de CI offline:** PR #640/#641 y PR #528 en sus respectivos commits.
- **NO E2E de aplicación:** no se invocaron WebMethods Velo desde UI, no se hizo login de miembro, no se probó bridge TPV, checkout, pagos, webhooks ni hardware. Wix MCP ExecuteWixAPI no puede invocar directamente los WebMethods del sitio; la ruta HTTP `/_functions-dev` probada anteriormente devolvió 403. No se usó TinyFish.

## 8. Plan mínimo de cierre MVP

1. **P1 Bookings:** reconciliar las seis proyecciones divergentes desde backend y demostrar relectura 11/11 coherente.
2. **P0 Caja/TPV:** crear un entorno de prueba realmente aislado o fixture de sesión aprobado; no reutilizar la caja singleton actual. Ejecutar WebMethods de apertura/venta/movimiento/cierre solo con gateway/terminal simulados.
3. **P0 Fiscal:** resolver #415/#209 con datos legales autorizados, identidad de emisor/SIF y asesoría; no crear configuración ficticia.
4. **P0 Compensaciones:** resolver #416 por correlación fuente; no cambiar estados ni fabricar ledgers.
5. **P1 Automatizaciones:** diseñar pruebas que no activen los siete triggers preinstalados; si no es posible demostrar aislamiento, excluir del E2E.
6. **P1 Concurrencia:** ejecutar en Runtime dos writers simultáneos y replay idempotente sobre sesión sintética aislada; verificar movimiento/proyección exactos.
7. **P2 Jornada:** implementar pruebas de fichaje con identidad sintética y política de retención antes de habilitar writer.
8. **P2 Capa 3:** probar paquete con fixture fiscal controlado y, en tenant SharePoint aislado, entrega idempotente y read-back de evidencia.
9. **Release:** verificar SHA/fingerprint instalado, Preview, permisos por rol, regresión completa y plan de reversión. No publicar como parte de esta fase.

## 9. Restricciones de integridad

Las colecciones declaradas como ledgers fiscales, contables, laborales, de caja física y cierres se mantienen inmutables/append-only, incluidos sus registros sintéticos cuando el contrato de la colección así lo establece. Las correcciones se realizan con eventos rectificativos trazables. Solo los artefactos de QA explícitamente desechables y no-ledger pueden resetearse, bajo identificador de test-run y procedimiento de limpieza probado.

**Decisión:** no se puede declarar MVP funcional E2E ni GO comercial. La capa de lectura de APIs Wix sí se ha ejercitado realmente; el fallo Bookings detectado impide aceptar la coherencia de reservas y el resto de escritores sigue bloqueado o sin runtime probado.
