# Canon de arquitectura — Marian Madrid

**Vigencia:** 2026-11-27. Para estado, bloqueos y siguiente sesión prevalecen [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md). Para el TPV prevalece [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md). Las auditorías fechadas son evidencia del instante observado, no una fuente de estado permanente.

## 1. Fuentes de verdad

- La documentación oficial vigente de Wix y de cada Wix App gobierna contratos de plataforma.
- Wix Bookings/Stores/Payments gobiernan sus respectivos dominios nativos.
- Wix CMS es SSOT transaccional de las entidades propias del proyecto.
- SharePoint es repositorio de documentos/evidencias; no gobierna ni modifica datos transaccionales de Capa 1.
- El repositorio Git es SSOT del código fuente versionado; no acredita por sí mismo el código instalado en Wix.
- La configuración y el estado de Runtime se consideran verificados solo mediante read-back fechado del entorno correspondiente.

## 2. Arquitectura por capas

- **Capa 1 — operación:** Wix Apps y CMS, backend Velo/WebMethods, eventos y jobs.
- **Capa 2 — control y consolidación:** validación, conciliación, ledgers y preparación de información derivada sin alterar la fuente nativa.
- **Capa 3 — documentación/evidencia:** preparación y entrega controlada de paquetes a SharePoint/Power Automate; nunca gobierna ni reescribe Capa 1.
- El frontend presenta y orquesta. La lógica de negocio, permisos, validación, clasificación y acceso a datos reside en backend.
- Los secretos se gestionan mediante Wix Secrets Manager o almacén seguro; nunca en frontend ni repositorio.

## 3. Contratos TPV vigentes

- Un único código, contrato, validación y writer para desarrollo y producción. No crear runtime de negocio paralelo por entorno o naturaleza del dato.
- `recordTimestamp` lo genera el backend en UTC. `recordNature` se deriva en backend comparándolo con `MapaStaff/CONFIG_SISTEMA.productionActivationAt`: anterior = SYNTHETIC; igual o posterior = REAL.
- La clasificación es metadato de trazabilidad, no selector de runtime. Sin singleton/corte configurado, el sistema clasifica como SYNTHETIC; fecha inválida o configuración ambigua falla cerrada.
- `TransaccionesTPV` contiene intenciones comerciales pendientes/no contables. `MovimientosCaja` es el ledger físico canónico. `ControlOperativo` guarda locks/auditoría; `CajaActual` es proyección de sesión.
- `registrarVenta()` aplica los mismos blockers que `validarVentaBorrador()`; no crea intención nueva si `saleReady=false`. El replay idempotente se resuelve antes del gate.
- No se infiere cobro por la existencia de una intención. Pago verificado, movimiento físico y registro fiscal son etapas separadas.
- Los ledgers físicos, fiscales, contables, laborales y cierres declarados append-only son inmutables; las correcciones se realizan con registros rectificativos trazables.

## 4. Reservas

- Bookings V2 es la fuente de verdad del estado nativo de la reserva.
- `CitasF2` es proyección propia; las divergencias se resuelven mediante reconciliación backend auditable e idempotente, no mediante estados inventados ni actualizaciones manuales sin lectura de origen.
- La lectura del 2026-11-27 encontró 6/11 proyecciones con estado CONFIRMED/PENDING frente a Bookings V2 CANCELED. Sigue siendo un fallo abierto.

## 5. Seguridad y fiabilidad

- Comprobar autorización en cada WebMethod; no confiar en rol, identidad, precios, impuestos, totales o clasificación enviados por el cliente.
- Webhooks, jobs, writers y reintentos deben ser idempotentes y trazables.
- No asumir transacciones multi-documento de Wix Data; definir recuperación de proyección y reconciliación.
- No usar REST/CMS directo para saltarse DAL, hooks, permisos o writers canónicos.
- Simular pagos, terminales y notificaciones durante QA; no generar efectos externos reales.
- No modificar ni borrar ledgers append-only, aunque sus registros sean sintéticos.

## 6. Capa 3

PR #641 integra la preparación de un paquete trimestral determinista, checksum SHA-256, minimización de campos y lectura estricta de registros REAL con WebMethod Admin-only. El paquete se prepara en memoria. No hay transporte SharePoint/Graph/Power Automate E2E acreditado.

## 7. Estado de aceptación

El MVP permanece NO-GO. La evidencia actual, fallos y siguiente secuencia están centralizados en [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md). No declarar runtime, E2E, despliegue o sincronización Git-Wix sin prueba específica del entorno.
