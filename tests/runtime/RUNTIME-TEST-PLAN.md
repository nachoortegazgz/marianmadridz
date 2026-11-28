# Wix Preview / Runtime — plan de aceptación TPV

**Estado:** PENDIENTE de ejecución Wix Runtime E2E. Última auditoría CMS/código: 2026-11-28.  
**Guía operativa y matriz de 20 pruebas:** [TPV-RUNTIME-AND-TEST-FLOWS](../../docs/TPV-RUNTIME-AND-TEST-FLOWS.md).

## 1. Objetivo y regla de ejecución

Acreditar bridge, permisos, WebMethods, persistencia, idempotencia, concurrencia, recuperación y documentos del TPV mediante operaciones ejecutadas en el runtime Wix.

El runtime utiliza un único código y las mismas reglas de dominio. No diferencia procesos ni datos por origen real/prueba. Los casos de prueba se identifican mediante el cliente de prueba acordado y el periodo de prueba; no se añaden flags, prefijos, colecciones paralelas ni filtros de negocio.

Durante QA: cero cobros bancarios, pagos externos, reembolsos, remesas fiscales o notificaciones reales. Una intención `PENDING_PAYMENT` no se considera pagada. No escribir directamente en CMS para simular una ejecución Velo.

## 2. Qué acredita cada nivel

- **HTTP render smoke:** disponibilidad/renderizado de una URL; no acredita página TPV funcional.
- **Bridge smoke:** handshake y mensajes permitidos entre HtmlComponent y página; no acredita WebMethods.
- **CMS REST:** lectura/escritura mediante REST; no acredita writers Velo ni idempotencia del TPV.
- **WebMethod test:** invocación del WebMethod en el runtime Wix y respuesta normalizada.
- **Integration:** interacción real entre UI, bridge, WebMethod, DAL y CMS.
- **Wix Runtime E2E:** recorrido funcional completo con read-back de las colecciones y auditoría.
- **Producción:** versión publicada y operación verificada; requiere autorización expresa.

No extrapolar un PASS de un nivel a otro.

## 3. Entornos Wix y restricciones conocidas

| Entorno | Uso | Restricción |
|---|---|---|
| Wix Editor Preview (Editor clásico) | Primera comprobación de página, bridge y lecturas | Preview puede ejecutar con rol Admin; no valida permisos de cajero por sí solo. Eventos backend pueden no dispararse. |
| Functional Testing del Editor | Invocación aislada de backend/WebMethods cuando la función esté soportada | Contexto Preview; validar limitaciones y no asumir E2E. |
| Local Editor con `wix dev` | Ejecutar código local sincronizado en Editor | Requiere CLI, acceso al equipo, Git Integration activa y comprobar repo/branch/UI version. |
| `wix preview` / Test Site | Pruebas que requieren versión publicada | El sitio Draft no cumple la precondición. Test Site puede compartir CMS con el sitio principal; no asumir aislamiento. |
| Sitio publicado | Verificar runtime/permisos reales | No publicar ni activar operaciones económicas como parte de esta batería. |

Referencias Wix:
- https://dev.wix.com/docs/develop-websites/articles/get-started/development-environments
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/test-your-code-in-the-local-editor
- https://support.wix.com/en/article/creating-a-release-candidate

## 4. Estado específico de Marian Madrid

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor clásico + Velo; estado conocido Draft/no publicado.
- No se ha acreditado la conexión activa de Git Integration con este repo ni que el SHA de `main` esté instalado en Wix.
- `wix preview` y Test Site no son rutas disponibles sin cumplir su precondición de publicación.
- La última lectura CMS observó una proyección `CajaActual` antigua en estado ABIERTA, cinco movimientos históricos, cero intenciones en `TransaccionesTPV`, 90 registros `ControlOperativo` y un cierre histórico. No reutilizar caja ni históricos para pruebas.
- La auditoría CMS REST anterior acreditó escritura/read-back de registros de evidencia en `ControlOperativo`, no invocación de WebMethods Velo.
- No se ha acreditado una venta, movimiento, arqueo, Ticket X, cierre Z o jornada en Wix Runtime.

## 5. Ruta de ejecución

1. Confirmar en el Editor clásico Git Integration, repositorio, rama y UI version. Verificar fingerprint del código cargado frente al SHA candidato.
2. Abrir Preview sin publicar. Registrar Site ID, UI version, commit/fingerprint, página TPV, fecha/hora, identidad y rol.
3. Ejecutar bridge smoke: `MM_READY → MM_CONTEXT`, contexto de miembro, capacidades, `CASHIER_STATE` y catálogo read-only. Registrar mensajes y errores.
4. Probar permisos backend: administrador, operador/cajero autorizado, estilista con el rol esperado y miembro sin rol. La autorización del WebMethod prevalece sobre la visibilidad de botones.
5. Resolver la proyección heredada mediante el flujo canónico de apertura; no actualizar `CajaActual` directamente.
6. Ejecutar TPV-RT-01…20 según la matriz de [TPV-RUNTIME-AND-TEST-FLOWS](../../docs/TPV-RUNTIME-AND-TEST-FLOWS.md): apertura, venta pendiente, replay/conflicto, entradas/salidas, arqueo, Ticket X, concurrencia, timeout/recuperación, cierre y operación posterior al cierre.
7. Tras cada operación, leer de vuelta las colecciones afectadas y correlacionar `sessionId`, `transactionId`, claves idempotentes, IDs y `traceId`.
8. Verificar documento Ticket X: registro en ControlOperativo y, separadamente, vista/descarga/PDF/impresión si la funcionalidad lo promete.
9. Confirmar cero efectos externos reales y que ningún histórico anterior se haya modificado.
10. Guardar evidencia con SHA, entorno, rol, método, respuesta, IDs, read-back y logs seguros.

## 6. Criterios PASS de Wix Runtime E2E

- Fingerprint del código instalado coincide con el SHA validado.
- Bridge y autorización backend funcionan con los roles probados.
- Apertura crea una sesión y proyección coherentes, sin reutilizar históricos.
- Venta válida crea una única intención comercial; no se presenta como cobro.
- Replay idéntico no duplica; misma clave con payload distinto genera conflicto.
- Movimientos y arqueos aparecen en el ledger y proyección, con operador, sesión, importe, motivo, estado y auditoría.
- Ticket X genera el documento de control esperado y no cierra la sesión.
- Cierre Z conserva histórico y bloquea operaciones posteriores.
- Recuperación ante timeout no duplica.
- Cero pagos, reembolsos, remesas y notificaciones externas reales.

## 7. No ejecutar / no certificar

- No publicar el sitio, activar pagos reales ni cerrar una caja operativa sin autorización expresa.
- No insertar directamente en CMS para fingir WebMethod PASS.
- No alterar CajaActual, MovimientosCaja o HistoricoCierresZ históricos para preparar una prueba.
- No crear ramas de runtime ni clasificar registros por origen de prueba.
- No declarar Runtime E2E PASS por tests unitarios, CI, HTTP smoke o CMS REST.
