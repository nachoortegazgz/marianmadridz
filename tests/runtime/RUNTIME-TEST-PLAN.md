# Wix Preview / Runtime — plan de aceptación TPV

**Estado:** NO EJECUTADO según la última evidencia fechada. Este plan separa pruebas de lectura, pruebas de aplicación aisladas y aceptación de operaciones productivas. No se exige configuración fiscal productiva para probar lógica sin efectos externos.

## Objetivo

Validar bridge, permisos, WebMethods, persistencia, idempotencia, concurrencia y recuperación en niveles proporcionales al riesgo, sin publicar ni producir efectos externos.

## Terminología y alcance de cada prueba

- **Runtime test:** ejecuta código Velo en el runtime alojado por Wix. Identifica siempre el entorno concreto: Preview del Editor, Local Editor, preview URL, test site o sitio publicado.
- **Smoke test:** subconjunto breve de comprobaciones básicas (carga, bridge, respuesta de lectura, ausencia de errores críticos). Puede ejecutarse en runtime, pero no demuestra flujos completos.
- **Online test:** describe que la prueba usa una URL/servicio accesible por red. No define por sí solo el entorno ni la profundidad de validación.
- **Integration test:** verifica el contrato entre componentes reales (por ejemplo, HtmlComponent → page controller → WebMethod → CMS).
- **E2E:** recorre un caso funcional de principio a fin y verifica estado persistido, auditoría y ausencia de efectos no autorizados.

Un HTTP 200 o una página renderizada solo acredita disponibilidad/renderizado. No acredita runtime funcional, bridge, WebMethods, CMS ni E2E.

## Entornos Wix y viabilidad actual

| Entorno | Qué permite | Restricciones y decisión |
|---|---|---|
| Wix Editor Preview (Editor clásico) | Ejecutar la versión guardada en el Editor, inspeccionar Developer Console, bridge y lecturas | Primera opción inmediata. Preview asigna rol Admin; no valida permisos de cajero. Los eventos backend no se disparan. |
| Functional Testing del Editor | Invocar backend/WebMethods de forma aislada | Se ejecuta en contexto Preview y hereda sus limitaciones. Solo métodos read-only hasta disponer de fixture aislado. |
| Local Editor con `wix dev` | Ejecutar código local sincronizado en el Editor sin publicar | Wix documenta soporte para Wix Editor y Wix Studio. Requiere Git Integration activa para este sitio y repo, acceso Velo/GitHub y entorno local. La existencia de `wix.config.json` no demuestra por sí sola que la conexión esté activa. Verificar repo, branch y UI version en el panel GitHub del Editor antes de usarlo. |
| `wix preview` (CLI, URL compartible) | Crear preview remoto del código de la rama/local IDE | Requiere que el sitio haya sido publicado al menos una vez. Marian Madrid está en Draft/no publicado: no es una vía disponible sin publicar. No ejecutar este workflow hasta cambiar esa precondición con autorización. |
| Test Site / Release Manager | Probar funciones que necesitan versión publicada, incluidos eventos que no corren en Preview | También requiere publicación previa. El test site comparte los datos live del sitio principal; exposición 0% no aísla CMS ni evita efectos sobre datos compartidos. No usar para writers TPV con la caja singleton actual. |
| Sitio publicado | Verificar runtime y permisos reales | Fuera del alcance actual. No publicar ni activar operaciones económicas como parte de QA. |

Documentación oficial consultada: Wix Editor admite Git Integration + Wix CLI for Sites; `wix dev` abre Local Editor. `wix preview` y Test Sites requieren publicación previa. Referencias:
- https://dev.wix.com/docs/develop-websites/articles/get-started/development-environments
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands
- https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/test-your-code-in-the-local-editor
- https://support.wix.com/en/article/creating-a-release-candidate

## Estado específico de Marian Madrid (27-11-2026)

- Wix GetSiteContext confirma Editor clásico, Velo habilitado y estado Draft. El sitio no consta como publicado.
- El repositorio contiene `wix.config.json` con el Site ID correcto, pero no se ha verificado desde el panel del Editor que Git Integration esté conectada a este repositorio ni que el SHA de `main` sea el código instalado.
- Existe `.github/workflows/wix-tpv-preview.yml`. Su job ejecuta `wix preview`; por tanto, con el sitio aún no publicado al menos una vez, el job no puede completar la creación de preview. El input `create_preview=false` evita que se ejecute.
- `scripts/wix-preview-smoke.mjs` bloquea peticiones dinámicas y no realiza interacciones. Solo comprueba respuesta HTTP/renderizado básico del documento y registra errores. No visita específicamente el TPV ni ejecuta bridge, WebMethods o lecturas CMS. Su resultado debe denominarse **HTTP render smoke**, nunca Runtime TPV PASS.
- El estado CMS conocido incluye `CajaActual` singleton ABIERTA y ledgers/históricos existentes. No son fixtures y no se usarán para probar mutaciones.

## Ruta de ejecución recomendada

1. **Ahora, sin publicar:** comprobar en el Editor clásico si GitHub Integration está conectada al repo `nachoortegazgz/marianmadridz`. Si lo está, usar `wix dev` desde el ordenador con el repo clonado y Node.js 24.22.1; si no, sincronizar manualmente los archivos Velo/HTML aprobados al Editor. No conectar ni sustituir repositorios sin revisar el vínculo existente.
2. Abrir Preview desde el Editor y registrar Site ID, UI version, commit SHA esperado, página `/tpv`, hora, usuario y rol. Leer Developer Console y DevTools.
3. Ejecutar smoke read-only de TPV: página correcta, HtmlComponent presente, handshake `MM_READY → MM_CONTEXT`, identidad devuelta, capacidades, `CASHIER_STATE`, catálogo de lectura y ausencia de errores no explicados. No invocar `SESSION_OPEN`, movimientos, arqueos, Ticket X si crea auditoría, ventas ni otros writers.
4. Ejecutar Functional Testing solo para métodos read-only o funciones cuyo contrato garantice no persistencia. Verificar los resultados con una segunda lectura.
5. Para integración con escrituras, preparar primero un sitio/espacio de prueba realmente aislado y verificar el destino de cada writer. No basta con sandbox de CMS: las colecciones de apps Wix pueden seguir siendo live. No usar `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` ni ledgers actuales como fixture.
6. Solo cuando exista aislamiento demostrado, probar writer canónico, read-back, idempotencia y concurrencia con dos sesiones/operaciones controladas. Efectos de Payments, AEAT, terminales, emails y proveedores permanecen simulados.
7. Si una capacidad exige publicación (eventos backend o APIs no disponibles en Preview), documentar el gap. No publicar el sitio actual para resolverlo; solicitar un test site aislado o una estrategia de entorno separada y autorización explícita.

## Niveles de prueba

### A. Lectura y diagnóstico

Puede ejecutarse sin fixtures ni escrituras: fingerprint, handshake, catálogo de diagnóstico, permisos efectivos y lectura de estado. No requiere sesión de caja sintética ni configuración fiscal productiva.

### B. Pruebas de dominio y contrato

Se ejecutan en CI con fixtures explícitos y adaptadores simulados. Deben probar tanto los rechazos fail-closed esperados como los recorridos válidos del dominio. No requieren identidad Wix, CMS real, serie fiscal productiva, pagos, SharePoint ni configuración de activación real.

### C. Integración Wix aislada

Precondiciones específicas:
1. Preview del sitio correcto y fingerprint/build SHA leído.
2. Identidad de prueba y permisos efectivos verificados para los WebMethods invocados.
3. Tenant/espacio de prueba o fixture aislado creado por el writer canónico, sin tocar `CajaActual` singleton ni ledgers históricos compartidos.
4. Pagos, AEAT, terminales, notificaciones y otros efectos externos interceptados por adaptadores simulados.
5. IDs de correlación y limpieza/reversión limitados a datos de test no append-only. Los registros append-only de test se conservan y se rectifican mediante nuevos eventos.

No es precondición para esta categoría disponer de configuración fiscal productiva, credenciales de cobro, serie real o datos de clientes reales.

### D. Aceptación productiva

Requiere configuración legal/fiscal validada, permisos, proveedores reales autorizados, pruebas operativas y aprobación correspondiente. No se ejecuta como parte de QA sintético.

## Secuencia recomendada

1. **Bridge read-only:** handshake `MM_READY → MM_CONTEXT`, diagnóstico y validación de protocolo.
2. **Autorización:** roles permitidos y denegados en WebMethods.
3. **Preflight:** comprobar resultado con configuración ausente/incompleta y con fixture válido.
4. **Gate real:** verificar que `registrarVenta()` rechaza la operación no preparada sin persistir una intención.
5. **Dominio simulado:** ejecutar el mismo flujo con fixture fiscal/catalogo y puertos simulados; comprobar intención y resultados en repositorio de test, sin pago ni ledger productivo.
6. **Idempotencia:** replay idéntico no duplica; payload conflictivo se rechaza.
7. **Concurrencia:** dos operaciones con la misma clave/recurso; comprobar adquisición única y respuesta determinista.
8. **Persistencia/recuperación:** read-back del repositorio aislado, lock, auditoría y proyección; simular timeout/reintento.
9. **Cierre/arqueo:** probar cálculos y contrato con fixture/dobles en CI. Cualquier persistencia append-only en Wix requiere fixture aislado y conservar el registro; nunca usar la caja o históricos existentes.

## Evidencia

Por prueba guardar commit/fingerprint, entorno, identidad/rol cuando aplique, método, payload anonimizado, IDs de correlación, resultado, read-back y logs. No registrar secretos, datos de tarjeta ni datos personales innecesarios.

## Criterios PASS

- Fingerprint coincidente para pruebas Wix.
- Bridge y autorización backend correctos.
- Gates reales rechazan operaciones no preparadas.
- El mismo dominio funciona con fixtures y adaptadores simulados.
- Persistencia lógica idempotente y concurrencia controlada en el repositorio probado.
- Cero efectos externos reales.
- Ninguna mutación de caja singleton ni ledger histórico compartido.

Un smoke HTTP, test estático, mock o CI offline no acredita Runtime E2E; sí acredita el nivel concreto que realmente ejecuta.
