# Plan de acción QA y preparación de despliegue

**Corte:** 19-11-2026 · **Estado:** NO APTO PARA DESPLIEGUE

Ejecutar en orden. No inferir cierre por la mera existencia de código. Estado: [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md). Reglas: [DIRECTRICES_DESARROLLO_CODIGO.md](DIRECTRICES_DESARROLLO_CODIGO.md).

## P0 — Integridad y baseline

### P0.1 Reconciliar pedidos POS y compensaciones
- Leer de nuevo pedidos, transacciones, movimientos de caja y compensaciones.
- Reconstruir trazabilidad pedido → pago → movimiento → ledger/compensación.
- No crear movimientos, reintentar compensaciones ni corregir ledgers por inferencia.
- Cerrar con evidencia y aprobación del propietario.

### P0.2 Revalidar entorno Wix
- Confirmar Site ID, estado Draft/Published, Editor, Velo, permisos CMS y conexiones.
- Releer esquemas, registros y permisos; inventario del 17-11 es histórico.
- Auditar automatizaciones, notificaciones, webhooks y salidas externas.
- Mantener pruebas offline hasta demostrar neutralización.

### P0.3 Sincronización y toolchain
- Preservar y revisar el cambio local de `package-lock.json`; no restaurar sin conocer origen.
- Actualizar checkout por fast-forward y verificar HEAD/árbol limpio.
- Reconciliar `wix.lock` mediante flujo oficial desde checkout conectado a Wix; nunca editar manualmente.
- Verificar checkout → Local Editor → Wix. No usar `wix dev` sin confirmar que aplica a Editor Classic + Velo.

## P1 — TPV, caja y runtime

### P1.1 Contrato económico
- Definir DTO/persistencia para CASH, CARD y mixtos.
- Garantizar céntimos exactos, idempotencia, concurrencia, reintentos y referencias de proveedor.
- Separar intento, autorización/captura, confirmación técnica y liquidación bancaria.
- CARD no incrementa efectivo; CASH incrementa solo neto recibido.
- Validar devoluciones, movimientos fuente, proyección CajaActual y cierre Z.
- No habilitar writers fiscales/contables mientras sus gates sigan cerrados.

### P1.2 Hardware
- Inventariar PC/Windows, terminal, impresora y cajón.
- Obtener fabricante, modelo, firmware, drivers, interfaces y documentación SDK/API.
- Probar impresión ESC/POS y apertura del cajón por puerto de impresora.
- Decidir terminal autónomo/manual o integración certificada.
- No asumir control USB/LAN desde navegador ni compatibilidad con Wix Payments.
- Criterios: [HARDWARE_TPV.md](HARDWARE_TPV.md).

### P1.3 Wix Runtime
- Ejecutar pruebas tras neutralizar notificaciones/automatizaciones.
- Verificar autenticación, roles, WebMethods, permisos CMS y hooks.
- Probar doble envío, concurrencia, webhooks repetidos/desordenados y recuperación.
- Registrar SHA, Site ID, escenario, resultado y artefactos.
- Separar MOCK, Preview, runtime y E2E.

## P2 — Fiscalidad e integraciones

### P2.1 Fiscalidad
- Confirmar identidad fiscal y configuración legal con documentación oficial.
- Resolver SIF/VERI*FACTU, series, impuestos, anticipos, rectificaciones y devoluciones.
- No habilitar writers ni declarar conformidad sin revisión y pruebas aplicables.

### P2.2 Capa 3
- Auditar tenant M365, licencias, SharePoint, bibliotecas, permisos, retención, DLP y Power Automate.
- Aprobar ADR de transporte y contratos de exportación minimizados.
- Implantar solo flujos aprobados, unidireccionales e idempotentes.
- Validar E2E con tenant de prueba. PA-01…PA-07 son diseños, no flujos activos acreditados.

## P3 — Release readiness

- Resolver dependencias sin soporte mediante análisis de compatibilidad.
- Probar rollback y continuidad operativa.
- Revisar branch protection y required checks de `main`; no cambiar sin autorización.
- Preparar checklist con SHA, Site ID, backup, diff, CI, aprobaciones y verificación posterior.

## Gates de salida

| Gate | Criterio |
|---|---|
| G0 Integridad | Pedidos, pagos, caja y compensaciones reconciliados |
| G1 Entorno | Site ID, CMS, permisos y automatizaciones revalidados |
| G2 Toolchain | Checkout sincronizado, lockfiles reconciliados y flujo Wix documentado |
| G3 TPV | Contratos y hardware probados; sin doble cobro/movimiento |
| G4 Runtime | WebMethods, permisos, hooks, concurrencia e idempotencia probados |
| G5 Fiscal | Identidad, normativa, SIF/VERI*FACTU y writers validados |
| G6 Integraciones | Capa 3 y efectos externos probados con datos sintéticos |
| G7 Release | CI, diff, rollback, SHA/Site ID y autorización expresa |

No desplegar mientras exista gate P0/P1 abierto, test fallido, riesgo crítico sin mitigación o reversión no demostrada.
