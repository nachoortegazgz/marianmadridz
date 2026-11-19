# Estado actual del proyecto

**Corte:** 19-11-2026 · **Repositorio:** `nachoortegazgz/marianmadridz` · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor Classic + Velo

Este es el estado operativo de referencia. Los snapshots anteriores se conservan como evidencia histórica; no deben interpretarse como estado live actual.

## 1. Resumen ejecutivo

**NO APTO PARA DESPLIEGUE.** Los gates offline del último SHA conocido están verdes. Persisten bloqueos de sincronización local, toolchain, CMS/runtime, TPV física y fiscalidad.

| Área | Estado | Evidencia / límite |
|---|---|---|
| GitHub `main` | Verificado al corte previo | `eb0df0a3f798bb1cb7e3e5819eba08dfb76cd097` |
| CI backend offline | PASS | Run `44571150941` |
| Secret scanning | PASS | Run `44571150946` |
| Wix Editor / Velo | Contexto histórico | Editor Classic; última lectura registrada: Draft |
| SHA desplegado en Wix | Pendiente | Sin release ID que vincule runtime y commit |
| Checkout local | Pendiente | Último estado aportado: HEAD antiguo y `package-lock.json` modificado |
| Local Editor sincronizado | Pendiente | No acreditado |
| CMS live | Pendiente de relectura | Último inventario fiable resumido: 17-11 |
| Runtime / E2E | No validado | CI offline no prueba Wix ni integraciones |
| TPV física | Diseño | Terminal, impresora y cajón sin identificar |
| Fiscal / Veri*Factu | Bloqueado | Writers deshabilitados; identidad fiscal/configuración no acreditadas |
| Capa 3 M365 | No implantada/verificada | Tenant y flujos no auditados live en este corte |

## 2. GitHub y toolchain

- PR #418–#423 están integradas en `main`.
- PR #423 fijó `@wix/cli@1.2.14`, Node CI `24.22.1`, acciones por SHA y Preview manual con `create_preview=false` por defecto.
- Preview requiere el secreto GitHub `CLI_API_KEY`; solo se ejecuta al habilitarlo expresamente y no ejecuta Publish.
- Los workflows backend offline y secret scanning finalizaron correctamente sobre el SHA indicado. No acreditan Preview, Publish, runtime, hardware ni E2E.
- `wix.lock` resuelve `@wix/stores@1.0.960`, mientras `package.json` y `package-lock.json` declaran `1.0.997`. No editarlo manualmente; reconciliar desde el checkout conectado a Wix y revisar diff.
- El checkout local reportado estaba en `738eb78faaa48502532c83c3e4b8b53db1144950`, con `package-lock.json` modificado. No consta que se ejecutara fast-forward. No afirmar que el PC o Local Editor estén sincronizados.
- Wix CLI global `1.2.14`, Node local `26.13.0` y npm `12.2.2` fueron declarados mediante salida PowerShell. No se ha probado un comando de sincronización automática válido para Editor Classic + Velo.

## 3. Wix y CMS

- Site ID configurado en `wix.config.json`: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor Classic y Velo habilitado constan en el contexto de plataforma.
- Último estado observado: **Draft**. Repetir lectura live antes de Preview/Publish.
- No existe evidencia de que el código de GitHub sea exactamente el abierto en Local Editor o ejecutado por Wix.
- El inventario CMS del 17-11 describía 50 colecciones (21 NATIVE y 29 WIX_APP), 201 registros NATIVE. Es snapshot histórico, no autoriza escrituras o migraciones.
- En ese corte, MapaStaff tenía 43 campos y 5 registros; DatosFiscales y CONFIG_SISTEMA no existían. No inventar identidad fiscal ni placeholders.
- Revalidar esquemas, permisos, índices, registros y automatizaciones antes de operar.

## 4. TPV y caja

- Frontend TPV sin reglas económicas ni permisos; invoca WebMethods backend.
- Importes en céntimos enteros o estrategia decimal aprobada.
- `CASH` incrementa efectivo físico solo por el neto recibido tras cambio.
- `CARD` no incrementa efectivo físico.
- Pago mixto: componentes CASH/CARD cuya suma coincide exactamente con el total.
- Intento pendiente, fallido o cancelado no es cobro confirmado.
- Confirmación manual, confirmación técnica del terminal y liquidación bancaria son evidencias distintas.
- `MovimientosCaja` es histórico fuente; `CajaActual` es proyección. No crear movimientos por inferencia.
- X es snapshot no cerrante. Z es cierre operativo inmutable con arqueo, desglose por medios, diferencias, actor, fecha y fuentes. X/Z no son factura ni SIF/VERI*FACTU.

### Reconciliación pendiente

En el snapshot del 17-11 se detectaron tres compensaciones `FISCAL_LEDGER/PENDING_RECOVERY` y dos pedidos POS con estados económicos que requerían conciliación. Uno aparecía reembolsado; otro pagado en efectivo sin reflejo coherente en la proyección. No crear movimientos, reintentar compensaciones ni modificar ledgers hasta reconciliar el origen y obtener autorización.

## 5. Hardware TPV

Arquitectura objetivo en [HARDWARE_TPV.md](HARDWARE_TPV.md): PC Windows, red estable, impresora térmica ESC/POS, cajón compatible con puerto drawer-kick, terminal bancario independiente y alimentación protegida. Lector de códigos y pantalla cliente son opcionales.

No se ha seleccionado ni probado marca, modelo, driver, protocolo, SDK, cableado o middleware. No comprar ni implementar control desde navegador hasta validar compatibilidad.

## 6. Integraciones

- Bookings y Stores se operan mediante APIs oficiales; no escribir directamente en colecciones administradas por apps.
- Wix Payments no se considera integrado con el terminal bancario físico.
- SharePoint es repositorio documental. PA-01…PA-07 son diseños, no flujos activos verificados.
- No enviar comunicaciones, documentos fiscales, datos a gestoría ni exportaciones externas durante QA offline.

## 7. Bloqueos siguientes

1. Actualizar checkout local preservando y auditando el cambio local de `package-lock.json`.
2. Reconciliar `wix.lock` desde Wix CLI en el checkout correcto.
3. Obtener lectura live de Wix: estado, Site ID, CMS, permisos, automatizaciones y conexiones.
4. Reconciliar pedidos POS y compensaciones pendientes sin mutaciones inferidas.
5. Cerrar contrato TPV de pagos mixtos, estados, idempotencia, caja, devoluciones y cierre Z.
6. Identificar terminal, impresora y cajón; validar drivers y mecanismo de integración.
7. Ejecutar pruebas Runtime/Preview controladas con efectos externos neutralizados.
8. Completar identidad fiscal, análisis normativo y gates SIF/VERI*Factu.
9. Auditar tenant M365 y aprobar transporte antes de implantar Capa 3.
10. Preparar despliegue solo tras cerrar P0/P1, CI, diff, rollback y autorización.

## 8. Evidencia

**Verificado:** evidencia reproducible en GitHub, herramienta o lectura live identificada.  
**Declarado:** afirmación del propietario o salida aportada, sin verificación independiente.  
**Inferido:** conclusión razonada pendiente de comprobación.  
**Pendiente:** no hay evidencia suficiente o falta ejecutar la prueba.
