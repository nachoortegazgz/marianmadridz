# Consolidación del proyecto Marian Madrid — 2026-11-28

**Repositorio:** https://github.com/nachoortegazgz/marianmadridz  
**Rama de referencia:** `main`  
**Último commit de documentación comprobado antes de esta consolidación:** `1b353aedaff7e70ede288d6f732ba1f10bc3d2af`  
**Estado de publicación Wix:** Draft / no publicado.  
**Criterio de aceptación:** no confundir código integrado, CI offline, sincronización del Editor, Runtime Wix, E2E ni producción.

## 1. Resumen ejecutivo

El repositorio contiene una base técnica avanzada y varias correcciones recientes del TPV ya integradas. Las PR #711 y #712 constan como fusionadas en la documentación vigente de `main`. La PR #712 incorpora el flujo de intención comercial pendiente, permisos TPV para ADMIN/GESTION/ESTILISTA, y cierre físico Ticket Z idempotente. Su CI offline quedó PASS: 95 suites / 854 pruebas, más verificaciones de SDK Wix, ESLint, npm audit y secret scanning.

**El TPV todavía no está aceptado en Wix Runtime.** La fusión no acredita que el código esté sincronizado con Wix Editor/Preview. La última lectura CMS documentada después del reset muestra `CajaActual=0`, `MovimientosCaja=0`, `TransaccionesTPV=0`, `HistoricoCierresZ=1` y `ControlOperativo=90`. No se ejecutó apertura con 300 €, ni movimientos, venta, Ticket X/Z o E2E desde la interfaz.

**No-go vigente:** el sitio sigue Draft/no publicado. No hay autorización ni evidencia para publicar, efectuar cobros reales o activar efectos externos.

## 2. Estado Git comprobado

- Repositorio público: `nachoortegazgz/marianmadridz`.
- Rama principal: `main`.
- Último commit de documentación observado al iniciar esta consolidación: `1b353aedaff7e70ede288d6f732ba1f10bc3d2af` — `docs(TPV): reconcile singleton bootstrap status`.
- Commits de documentación inmediatamente anteriores observados:
  - `4d4b939c83224670a4d45ef66fd1d5ca50c607a9` — actualización del estado tras la fusión de PR #712.
  - `7358a11bc06dbb18ee37b63c22d1c3de78463f72` — evidencia CI y fusión de PR #712.
- PR #711: fusionada según `docs/STATE-NOW.md` y commit posterior.
- PR #712: fusionada en `main`; commit de merge indicado en el estado del proyecto: `2113da1e8b8928ca7e3eb0259ba37bc29a3c922f`.
- PR #709: la descripción anuncia `docs/TPV-RUNTIME-AND-TEST-FLOWS.md`, pero el archivo no existe en el `main` consultado. Tratar su contenido como no integrado hasta verificar la PR y su rama.
- No se ha identificado en esta revisión una lista fiable de cambios locales sin commit: la integración GitHub consultada permite inspeccionar y escribir el repositorio remoto, no leer el working tree de un ordenador local. Esta consolidación registra y versiona el estado remoto; no afirma haber sincronizado un clon local.

## 3. Tareas completadas e integradas

### 3.1 Capa 0 — hardening integrado, no cerrada

El estado vigente de `docs/STATE-NOW.md` registra integraciones de PR #662–#681, incluyendo:

- Serialización estricta de fingerprints y rechazo de estructuras no JSON válidas.
- Errores CMS diferenciados de ausencia real de registros.
- Configuración compartida centralizada en `SDK_CONFIG`.
- Endurecimiento SHA-256/HMAC y acceso a secretos.
- Validación de GUID, dinero y contratos de Bookings.
- Propagación de errores de proveedores y respuestas inválidas; no convertir errores en `false`, `null`, `NOT_FOUND` o listas vacías.
- Paginación Staff sin devolver resultados parciales cuando queda cursor pendiente.
- Logging y redacción recursiva de secretos, credenciales, tokens y PII.
- Sort Wix con propiedad oficial `order` y rechazo explícito de entradas inválidas.
- Metadatos de respuestas públicas JSON-safe.
- Contrato `transactionId` para el writer económico indicado en el canon.

Evidencia histórica documentada: PR #670 (88 suites / 794 pruebas), PR #675 (89 / 804), y hardening posterior #679/#681 (91 / 816 en el SHA correctivo correspondiente). No trasladar esos resultados a otros SHA sin CI nuevo.

**No marcar Capa 0 como completada.** Permanecen revisión del emisor fiscal, cobertura de Staff/service providers, normalizadores numéricos locales, matriz global de idempotencia/writers, auditoría de dead code, discrepancia contractual de `sourceType` y verificación del remitente de correo.

### 3.2 TPV — permisos de operadores

La línea de trabajo de PR #708 y su consolidación posterior habilita el contexto específico `requireTpvOperator` para ADMIN, GESTION y ESTILISTA en las operaciones TPV previstas. La ampliación se limita al TPV: no equivale a ampliar el guard genérico ni los permisos de módulos ajenos.

El estado consolidado de PR #712 confirma que ADMIN, GESTION y ESTILISTA validados pueden abrir sesión y registrar movimientos ordinarios. El bootstrap inicial del singleton y Ticket Z permanecen ADMIN-only. Auditoría, exportaciones y otras operaciones administrativas conservan sus guards específicos.

**Pendiente:** probar autorización real con miembros de cada rol en Wix Runtime. Preview del Editor asigna rol Admin y no demuestra por sí solo el acceso de ESTILISTA.

### 3.3 TPV — bootstrap de CajaActual (PR #711)

Integrada la inicialización backend del singleton cuando la colección está vacía:

- Crea exclusivamente el item fijo `SINGLE_ITEM_ID / CAJA_PRINCIPAL`.
- Estado inicial `CERRADA`, importes cero y contadores/metadatos canónicos.
- Ejecuta bajo lock compartido.
- Persiste mediante DAL, realiza read-back fuerte y valida integridad.
- Recupera un resultado incierto sin sobrescribir un singleton existente.
- No crea una apertura, movimiento, cierre histórico ni cobro.

La integración de código está documentada; la inicialización real desde Wix Runtime continúa pendiente.

### 3.4 TPV — intención pendiente y cierre Z (PR #712)

Cambios consolidados en `main`:

- El sistema mantiene un único flujo de negocio. No se crean ramas funcionales por prueba/sandbox/live ni se etiqueta la operación como sintética.
- Cuando `acceptPayment=false`, el widget no permite seleccionar tender ni presentar efectivo/tarjeta como cobro confirmado.
- El backend puede persistir una intención comercial sin tender con estado `PENDING_PAYMENT`. Es una intención pendiente, no una venta cobrada ni un movimiento físico.
- El frontend interpreta `PENDING` como resultado de negocio persistido, libera la clave idempotente cuando el backend confirma la persistencia y comunica que el cobro sigue pendiente.
- El resumen de sesión/Ticket Z separa `pendingSalesCount` y `pendingSalesGrossMinor` de ventas/importes cobrados.
- Las intenciones no cobradas no impiden el cierre físico. Reembolsos pendientes y fallos de conciliación sí mantienen sus validaciones.
- Ticket Z completa el cierre físico mediante un movimiento `CIERRE` idempotente y actualización de `CajaActual`; los reintentos recuperan el movimiento/proyección cuando el Z ya se persistió.
- `issueTicketZ` queda expuesto para ADMIN después de integrar el cierre completo.

**Validación CI PR #712:** run `46170554978`; Layer 1 29 suites / 398 pruebas; Layer 2 16 / 263; suite completa 95 / 854; SDK Wix Cart, Transactions y TPV PASS; npm audit y ESLint PASS. Secret scanning PASS, run `46170554976`.

### 3.5 Arquitectura y persistencia TPV

Contrato documentado en `docs/TPV-UNIFIED-FLOW.md`:

| Elemento | Responsabilidad |
|---|---|
| `TransaccionesTPV` | Intención comercial; no acredita cobro ni movimiento físico |
| `MovimientosCaja` | Ledger físico canónico |
| `ControlOperativo` | Locks, idempotencia técnica y auditoría |
| `CajaActual` | Proyección de sesión |
| `HistoricoCierresZ` | Evidencia de cierre inmutable |

Se mantiene el uso de DAL, hooks y writers canónicos. No se debe escribir CMS por REST directo para saltarse esas fronteras. Los movimientos físicos, cierres y ledgers contabilizados son append-only; corregir mediante nuevos eventos trazables, no editar/borrar históricos.

## 4. Tareas parciales o no integradas

| Área | Estado real | Evidencia / brecha |
|---|---|---|
| PR #709 — matriz de 20 pruebas TPV-RT | No acreditada en main | El archivo anunciado `docs/TPV-RUNTIME-AND-TEST-FLOWS.md` no se encontró en main. El plan Runtime existente sí está en `tests/runtime/RUNTIME-TEST-PLAN.md`. |
| PR #710 — separación ledger TPV/fiscal | Implementación descrita en rama/PR; integración no confirmada aquí | La PR documenta exclusión `recordSource=TPV_LEDGER`, preservación de contadores y cron nocturno observacional. El cierre Z manual sigue pendiente de `recordDomain` aprobado y contrato CMS. |
| PR #707 — handshake HtmlComponent y E2E autenticado | No aceptar como E2E completado | El plan describe nonce y origen opaco en frontera Wix, pero exige CI y ejecución autenticada con artefactos/read-back. |
| Ticket X / arqueo / movimientos | Código y contratos disponibles; Runtime no acreditado | No hay ejecución Wix posterior al reset documentada. |
| Impresión Epson y apertura física de cajón | Parcial | El código puede solicitar impresión; falta comprobar impresora, controlador ESC/POS y pulso físico de cajón. |
| Cobro con tarjeta/efectivo | No habilitado como cobro confirmado | No existe writer/pasarela de pago confirmada. No simular un tender en el navegador. |
| Reembolsos externos | No habilitados | Falta proveedor de reembolsos verificado. |
| Notificaciones externas | Deshabilitadas | No activar envío exterior durante QA. |
| Cierre Z fiscal manual | Parcial | PR #710 deja cron nocturno como verificación/alerta; cierre manual requiere `recordDomain` aprobado, contrato CMS y prueba Runtime. |
| Capa 3 / SharePoint / gestoría | Diseño documental | No hay evidencia de pipeline externo configurado, tenant/permisos, snapshot persistido ni E2E de entrega. |
| VERI*FACTU / QR | Dossier documental | No equivale a SIF implementado, configuración fiscal validada, comunicación AEAT ni ticket QR probado. |

## 5. Estado de Wix y datos — último snapshot documentado

Read-back CMS de solo lectura posterior al reset comunicado en la consolidación de PR #712:

| Colección | Registros |
|---|---:|
| `CajaActual` | 0 |
| `MovimientosCaja` | 0 |
| `TransaccionesTPV` | 0 |
| `HistoricoCierresZ` | 1 |
| `ControlOperativo` | 90 |

Es una lectura fechada, no una consulta live de esta consolidación. No se escribieron registros. No se debe restaurar un cierre de ayer ficticio ni inferir una apertura previa.

**Inconsistencia documental a vigilar:** snapshots anteriores citaban `CajaActual=1 ABIERTA` y cinco movimientos. Esos datos corresponden a una lectura anterior al reset; el snapshot posterior documentado es 0/0. El dato más reciente prevalece para planificar la siguiente prueba. No reutilizar los registros históricos ni la caja singleton previa como fixtures.

Sitio Wix: ID `188bed94-177c-4bc9-a9f0-35080d874f3e`, Editor clásico, Velo, Draft/no publicado. No se ha acreditado que el SHA actual de main esté sincronizado con el Editor.

## 6. Pendientes priorizados

### P0 — recuperar y probar el flujo interno de caja

1. Confirmar en Wix Editor clásico el repositorio, rama y estado real de Git Integration; no sustituir una conexión existente sin inspeccionarla.
2. Sincronizar la versión aprobada de `main` con Wix Editor y registrar SHA/build, Site ID y revisión.
3. Abrir Preview desde el Editor. Verificar carga TPV, HtmlComponent, handshake, identidad, capacidades y lectura de estado; capturar errores de consola.
4. Invocar el bootstrap `inicializarCaja()` como ADMIN. Confirmar read-back de exactamente un singleton `CajaActual`, estado CERRADA y contadores válidos.
5. Ejecutar apertura de caja con fondo inicial 300 € en efectivo, fecha/hora de prueba indicadas por el operador. Verificar recibo de apertura, `transactionId`, `movementId`, operador, sesión y read-back en `MovimientosCaja` y `CajaActual`.
6. Registrar dos movimientos ordinarios con identidad y conceptos diferenciados; verificar importes, secuencia, hash, idempotencia, proyección y auditoría.
7. Probar lectura y operaciones permitidas para ADMIN, GESTION y ESTILISTA con identidades reales de cada rol. No inferir el rol desde Preview Admin.
8. Probar arqueo parcial, Ticket X y Ticket Z solo después de comprobar el contrato y la precondición de sesión. Ticket Z debe dejar una única anotación `CIERRE` y una proyección CERRADA, incluso tras reintento.
9. Cada escritura debe terminar en read-back y evidencia correlacionada. No declarar éxito por el mensaje de interfaz solamente.

**Restricción de entorno:** el sitio está Draft. La primera vía es Editor Preview para lectura/bridge. Preview asigna Admin y no valida roles; los WebMethods de escritura requieren un espacio/destino de prueba realmente aislado. No usar la caja singleton ni ledgers históricos compartidos como fixture. No publicar para habilitar `wix preview` o Test Site sin autorización expresa.

### P1 — cerrar integridad y contratos

- Completar la remediación B-BK-01 con prueba aislada de separación de lectores TPV/fiscales y conservación de contadores.
- Aprobar y configurar `recordDomain` para cierre Z manual; validar todos los campos required de `HistoricoCierresZ`.
- Reconciliar `sourceType` en esquema CMS, writers, readers, validadores, tests e históricos antes de retirarlo o mantenerlo.
- Completar matriz de writers: identidad, transactionId/clave idempotente, append-only, timeout, insert incierto, recuperación y call sites.
- Revisar `_getEmisorFiscal` y normalizadores numéricos locales; los fallos no pueden convertirse silenciosamente en NIF vacío o cero.
- Verificar cobertura de Staff Members v1 para todos los recursos/roles del sitio.
- Revisar la configuración del remitente de correo y la verificación del dominio .es antes de habilitar envíos.

### P2 — Capa 3 y operación externa

- Resolver C3-FINDING-001 y C3-FINDING-002 en exportación, con pruebas.
- Confirmar software, formato y plan contable de gestoría; PGC/PGC PYMES y ámbito fiscal con asesoría.
- Verificar tenant, bibliotecas, permisos y propietario SharePoint; decidir Graph o canal alternativo.
- Persistir snapshot exacto antes de enviar paquetes a gestoría; el envío no debe declarar archivado un paquete que no se ha persistido.
- Implementar y probar el transporte externo idempotente, con acuse, errores y recuperación.
- Elegir SIF y modalidad VERI*FACTU con asesoría; completar configuración, contrato AEAT, QR y pruebas de impresión antes de afirmar conformidad.

## 7. Flujos de trabajo que han funcionado

### 7.1 Flujo de cambio de código GitHub

1. Buscar el repositorio instalado y confirmar owner/repo y rama por defecto.
2. Inspeccionar PRs, ramas, commits y estado de main antes de editar.
3. Leer los archivos completos relevantes y sus contratos/tests; no editar a partir de excerpts.
4. Crear rama desde el HEAD actual de main para cada cambio coherente.
5. Hacer cambios mínimos por dominio, añadir regresiones para cada early return, bloqueo, reintento e insert incierto.
6. Ejecutar en orden Layer 1, Layer 2, suite completa, verificaciones SDK Wix, ESLint, npm audit y secret scanning.
7. Revisar diff y documentación; abrir PR con alcance, límites, evidencia exacta y pendientes Runtime.
8. Fusionar solo con CI verde y base actualizada; registrar SHA de merge y actualizar STATE-NOW/INDEX.
9. Verificar de nuevo el HEAD de main y los archivos después de la fusión.

### 7.2 Flujo de diagnóstico Wix seguro

1. Empezar por read-back de Site Context y colecciones, sin mutaciones.
2. Separar datos observados de hipótesis y fechar cada snapshot.
3. Inspeccionar el contrato backend y el WebMethod antes de atribuir el fallo a la caja o al widget.
4. Verificar bridge y autorización con lecturas antes de invocar writers.
5. No llamar a un WebMethod de escritura si no se ha demostrado el destino aislado y sus efectos.
6. Después de cada escritura autorizada, hacer read-back de la colección/proyección y correlacionar IDs.
7. Mantener sin ejecutar cobros, reembolsos, notificaciones, AEAT, impresión física y publicación salvo autorización específica.

### 7.3 Flujo de documentación y consolidación

- `docs/STATE-NOW.md` es la fuente de estado y evidencia fechada.
- `docs/PROJECT-CANON.md` contiene invariantes y decisiones aprobadas.
- `docs/TPV-UNIFIED-FLOW.md` define el contrato funcional TPV.
- `tests/runtime/RUNTIME-TEST-PLAN.md` define los niveles y precondiciones de aceptación Wix.
- `docs/INDEX.md` es el punto de navegación.
- Dossiers y auditorías registran hallazgos, cambios y evidencias; no sustituyen CI ni read-back.
- Los snapshots antiguos se conservan como históricos, pero nunca prevalecen sobre un read-back posterior.

## 8. Criterios de salida

No marcar TPV como operativo hasta demostrar todos los siguientes puntos con evidencia de la versión sincronizada:

- [ ] SHA de código identificado y sincronizado con Wix Editor.
- [ ] Bootstrap de singleton correcto y read-back.
- [ ] Apertura de caja con 300 € y movimiento APERTURA correlacionado.
- [ ] Dos movimientos ordinarios persistidos y proyectados correctamente.
- [ ] Roles ADMIN/GESTION/ESTILISTA probados con identidades respectivas.
- [ ] Arqueo parcial y Ticket X verificados.
- [ ] Ticket Z idempotente, movimiento CIERRE único y caja CERRADA.
- [ ] Read-back de todas las colecciones y ausencia de duplicados.
- [ ] Cero efectos externos no autorizados.
- [ ] Evidencia de logs, errores, IDs y resultado por cada paso.

**Conclusión:** PR #711 y #712 llevan el backend TPV a un estado implementado y validado offline. El siguiente hito no es añadir más gates genéricos ni reconstruir la caja desde datos inventados: es sincronizar el código aprobado con Wix Editor, comprobar el bridge y ejecutar una prueba de persistencia aislada y correlacionada. El proyecto sigue NO-GO para publicación y aceptación operativa hasta completar esa prueba.
