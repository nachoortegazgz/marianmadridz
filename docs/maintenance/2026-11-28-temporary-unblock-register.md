# Consolidación de avances y registro de mantenimiento — 2026-11-28

**Proyecto:** Marian Madrid · Wix Classic + Velo  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama base:** `main`  
**HEAD de main verificado:** `796e8eaf8317d35d02744f40d0504e9a00d29c20` (merge PR #706)  
**Rama de consolidación:** `maintenance/temporary-unblock-register-2026-11-28`  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Fecha de consolidación:** 2026-11-28

## 1. Dictamen ejecutivo

Se consolida la evidencia disponible en GitHub y la auditoría de lectura Wix CMS del 2026-11-28. Esta intervención es documental: **no modifica lógica de negocio, permisos, flags, datos CMS, pagos ni configuración de Wix**.

Estado global: **IMPLEMENTACIÓN PARCIAL · LECTURA CMS EJECUTADA · E2E/RUNTIME NO ACREDITADO · PRODUCCIÓN NO VERIFICADA**.

No se declara desbloqueo temporal aplicado. No se desconectó ningún control porque no se ejecutó una modificación funcional ni existe evidencia suficiente para distinguir con seguridad qué writers pueden habilitarse sin afectar datos, operaciones o integridad.

## 2. Avances de código incorporados en main

Los siguientes cambios constan en el historial de GitHub anterior o igual al HEAD indicado:

| Commit | Avance documentado | Alcance / límite |
|---|---|---|
| `981c4f80c0574922f4ae6759d109cab77cffed0e` | Handshake del widget TPV: allowlist exacta para dominio y Preview; sin comodín ni fallback silencioso | Cambio de origen permitido; no acredita conexión Runtime |
| `e3b9f28c1f7e9f675a01225da0719e446e0bd51c` | Separación entre validación de desglose y confirmación de pago | Un pago no se considera cobrado por estar asignado |
| `d12ae15a892af4e62df13db7fcc8a2f2c3f070ae` | Retirada de la dependencia de `SIMULATED_SUCCESS` para reconocer una proyección legacy de caja | Compatibilidad histórica de lectura; no autoriza escrituras |
| `40b6cca1d37444720e69b46f562c634cc82d1c2c` | Corrección del guard de ledger y retirada del filtro `SMOKE_TEST` en reconciliación | No se ha acreditado reconciliación Runtime |
| `a6a99d54023145b0701b3d3542c3142645ef54b7` | Validación estricta de año y trimestre en vista previa del paquete de gestoría | Validación estática de entrada |
| `63fd62ed726a822482fa73db0b2dae148cfc2837` | Incorporación de runner Playwright para Preview autenticado | Runner añadido; no equivale a E2E ejecutado ni aprobado |
| `556293171db8bf0a241e99fca65fecd6cfdcc7bd` | Exportación de movimientos incluye `transactionId`, secuencia, hash, hash previo, timestamp y traceId | Expone identidad/integridad para comprobación; no demuestra que todos los registros existentes sean válidos |
| `cf78af1041a0fd46dd2a64bc68acb89fd64c318a` | Refuerzo de validación de venta, impuestos, reembolsos y estado de caja; auditoría idempotente de reembolso bloqueado | Mantiene explícita la diferencia entre pago asignado y pago confirmado |
| `8a08a1b627d961f0f6a6ab1dc1db45341eb68dfa` | Ajustes del módulo de catálogo TPV y normalización de consultas/errores | No se atribuye prueba Runtime |
| `796e8eaf8317d35d02744f40d0504e9a00d29c20` | Merge de PR #706, runner E2E autenticado de Preview | HEAD actual verificado en la consulta del 2026-11-28 |

## 3. Controles que permanecen activos en el HEAD revisado

Los valores siguientes se verificaron en los archivos de `main` consultados:

| Control | Valor observado | Consecuencia |
|---|---:|---|
| `STAFF_CLOCKING_CONFIG.WRITES_ENABLED` | `false` | `registrarFichaje` devuelve `CLOCKING_WRITES_DISABLED` antes de insertar |
| `STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED` | `false` | `registrarAjusteHorario` devuelve `CLOCKING_ADJUSTMENTS_DISABLED` |
| TPV `acceptPayment` | `false` | No se confirma ni captura un pago mediante esta capacidad |
| TPV `printReceipt` | `false` | Impresión física deshabilitada |
| TPV `requestRefund` | `false` | Reembolso TPV deshabilitado |
| TPV `issueTicketZ` | `false` | Cierre Z TPV deshabilitado |
| TPV `exportAudit` | `false` | Exportación de auditoría deshabilitada |
| `TPV_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED` | `false` | Notificaciones externas deshabilitadas |
| `TPV_RUNTIME_POLICY.HARDWARE_ENABLED` | `false` | Hardware físico deshabilitado |
| `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED` | `false` | Envío externo a gestoría deshabilitado |

El módulo `tpvPermisos.web.js` permite capacidades de lectura y expone algunas capacidades operativas condicionadas al rol ADMIN. Eso no elimina los bloqueos específicos anteriores ni sustituye las validaciones de cada writer.

No se ha encontrado ni aplicado un interruptor global de escritura CMS. Las escrituras se gobiernan por writer, permisos, validación, hooks físicos, contrato de colección, locks e idempotencia.

## 4. Salvaguardas que no deben desconectarse como si fueran bloqueos de mantenimiento

- Autorización en backend y comprobación de identidad/rol.
- Validación de esquema y campos required reales de CMS.
- `transactionId` obligatorio y unicidad/idempotencia por operación.
- Locks, fencing y control de concurrencia.
- Secuencia, hash y encadenamiento de registros del ledger.
- Append-only de registros contables, fiscales y laborales; rectificaciones mediante nuevos registros trazables.
- Validación de pago confirmado antes de afirmar una venta como cobrada.
- Protección contra reembolsos duplicados y efectos externos no autorizados.
- Validación del origen del widget mediante allowlist exacta.

La inmutabilidad no impide insertar nuevos registros válidos; impide editar o borrar los existentes.

## 5. Hallazgo prioritario en el runner E2E incorporado por PR #706

El archivo de prueba añadido en `63fd62ed726a822482fa73db0b2dae148cfc2837` no es una prueba exclusivamente de lectura. Su flujo puede:

1. Cerrar una sesión que ya estuviera abierta.
2. Abrir una sesión nueva.
3. Insertar una entrada de efectivo de 1,00 EUR.
4. Generar Ticket X.
5. Cerrar la sesión.
6. Consultar movimientos y auditoría para verificar persistencia.

Además, el runner incorpora el literal `dataEnvironment: "SANDBOX_EXPECTED_CMS_SANDBOX_MUST_BE_ENABLED"`. Esto contradice la directriz vigente del proyecto: un único flujo/runtime sin ramas ni etiquetas operativas real/sintético/sandbox; los datos anteriores a 2027 se identifican por fecha y cliente de prueba.

**Estado: NO EJECUTAR el runner tal como está.** Antes de usarlo hay que corregir, como mínimo:
- Eliminar la clasificación/condición `dataEnvironment` y cualquier requisito de runtime sandbox.
- Eliminar el cierre automático de una sesión preexistente. Una prueba no puede cerrar una caja que no haya creado ella misma.
- Asegurar que la prueba solo opera sobre la sesión y el cliente de prueba expresamente seleccionados.
- Mantener `transactionId`, idempotencia, locks, validaciones y comprobación de lectura posterior.
- Probar que la limpieza/reversión no edita ni borra registros append-only; si se necesita compensación, crear un nuevo movimiento trazable.

La presencia del runner en GitHub **no** significa que se haya ejecutado. No se ha encontrado evidencia de ejecución en esta intervención.

## 6. Auditoría de persistencia CMS — evidencia y límites

La auditoría `docs/audits/2026-11-28-operational-persistence-audit.md` documenta una lectura Wix del 2026-11-28, solo lectura y sin mutaciones. El documento registra:
- Sitio en estado Draft en el momento de la lectura.
- Lectura de 12 colecciones propias NATIVE y contraste con fuentes nativas de Bookings V2 y eCommerce.
- `CajaActual` con proyección abierta divergente frente a los movimientos observados.
- `MovimientosCaja` con 5 registros y campos required ausentes en esos registros históricos.
- `HistoricoCierresZ` con un registro incompleto.
- `TransaccionesTPV` con 0 registros.
- 3 elementos de recuperación pendientes en `ControlOperativo`.
- 6 de 12 proyecciones `CitasF2` con estado divergente respecto a Bookings V2.
- `RegistrosHorariosStaff` con 0 fichajes.
- `LibroAsientosContablesDetalle` sin asientos PGC completos.
- Ausencia observada de configuración fiscal singleton `CONFIG_SISTEMA_FISCAL`.

**Precisión temporal:** esa auditoría es una fotografía de datos/implementación del momento de su lectura y cita un HEAD anterior. Los commits posteriores de la tabla anterior corrigen algunos contratos de código, pero no se ha repetido la lectura CMS ni se han verificado nuevas inserciones. No se deben presentar los conteos de la auditoría como estado actualizado del CMS sin repetir la consulta.

## 7. Estado de validación

| Nivel | Estado | Evidencia disponible |
|---|---|---|
| Estático | PARCIAL | Archivos y commits inspeccionados en GitHub |
| Unitario | PENDIENTE DE REEJECUCIÓN | Hay suites/contratos en el repositorio; no se ejecutaron en esta intervención |
| Integración | PENDIENTE | No se ejecutó prueba integrada |
| Regresión | PENDIENTE | No se ejecutó suite completa |
| E2E Preview | PENDIENTE | Runner añadido por PR #706, sin resultado de ejecución aportado |
| Runtime Wix | PENDIENTE | No se abrió ni probó el sitio desde esta intervención |
| Producción | NO VERIFICADO | No se ha desplegado ni comprobado sitio publicado |

La consulta de estado combinado de GitHub para `796e8eaf8317d35d02744f40d0504e9a00d29c20` devolvió una lista de estados vacía; esto no acredita CI PASS ni CI FAIL.

## 8. Plan de continuación priorizado

1. **P0 — Corregir el runner E2E:** retirar la etiqueta sandbox y evitar cerrar sesiones preexistentes. Mantener el único runtime y los controles de integridad.
2. **P0 — Revalidar contratos CMS físicos:** comparar required fields/hooks con el payload TPV actual y ejecutar insert/read-back controlado sobre la colección permitida.
3. **P1 — Caja/ledger:** verificar reconciliación entre `CajaActual` y `MovimientosCaja`; no sobrescribir históricos.
4. **P1 — Venta y pago:** separar intención comercial, asignación de medio de pago y confirmación del proveedor. No marcar cobrada sin confirmación.
5. **P1 — Reservas duales:** reconciliar `CitasF2` desde Bookings V2 y comprobar entrega de cancelaciones; no editar proyecciones a mano.
6. **P1 — Jornada:** implementar idempotencia, secuencia y concurrencia antes de habilitar los writers; ajustes append-only.
7. **P2 — Integración/Capa 3:** recuperar los elementos pendientes mediante outbox/reintentos idempotentes y evidencia de entrega/read-back.
8. **P2 — Documentación:** actualizar Dossier Técnico Consolidado y Dossier E2E solo después de disponer de resultados reproducibles.

## 9. Registro de cambios de esta intervención

- Se actualiza este documento en la rama `maintenance/temporary-unblock-register-2026-11-28`.
- No se modifica código de aplicación.
- No se modifican flags ni permisos.
- No se realizan escrituras CMS, pagos, reembolsos, fichajes, cierres, comunicaciones ni operaciones físicas.
- No se despliega a Wix.
- La rama se propone mediante PR para revisión; no se fusiona automáticamente.

## 10. Fuentes internas

- Auditoría CMS: `docs/audits/2026-11-28-operational-persistence-audit.md`.
- Commits enumerados en la sección 2 del repositorio GitHub.
- Código inspeccionado: `src/backend/internalConfig.js`, `src/backend/tpv/tpvPermisos.web.js`, `src/backend/horario.web.js`, `src/backend/tpv/tpvVentas.web.js` y runner E2E incorporado por PR #706.
