# Canon de arquitectura — Marian Madrid

**Vigencia:** 2026-11-27. Para estado medible prevalecen [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md). Para TPV prevalece [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md).

## 1. Fuentes de verdad

- La documentación oficial vigente de Wix y de cada Wix App gobierna contratos de plataforma.
- Wix Bookings/Stores/Payments gobiernan sus respectivos dominios nativos.
- Wix CMS es SSOT transaccional de las entidades propias del proyecto.
- SharePoint es repositorio de documentos/evidencias; no gobierna ni modifica datos transaccionales de Capa 1.
- Git es SSOT del código fuente versionado; no acredita por sí mismo el código instalado en Wix.
- El estado Runtime se verifica mediante evidencia fechada del entorno correspondiente.

## 2. Arquitectura por capas

- **Capa 1 — operación:** Wix Apps y CMS, backend Velo/WebMethods, eventos y jobs.
- **Capa 2 — control y consolidación:** validación, conciliación, ledgers y preparación de información derivada sin alterar la fuente nativa.
- **Capa 3 — documentación/evidencia:** preparación y entrega controlada de paquetes a SharePoint/Power Automate; nunca gobierna ni reescribe Capa 1.
- El frontend presenta y orquesta. La lógica de negocio, permisos, validación, clasificación y acceso a datos reside en backend.
- Los secretos se gestionan mediante Wix Secrets Manager o almacén seguro; nunca en frontend ni repositorio.

## 3. Contratos TPV vigentes

- Un único código, contrato de dominio y reglas de negocio para desarrollo, pruebas y producción. Los tests pueden inyectar fixtures y adaptadores simulados en los límites de infraestructura; no constituyen un runtime de negocio alternativo.
- `recordTimestamp` lo genera el backend en UTC. No existe clasificación `recordNature` ni diferenciación REAL/SYNTHETIC/SIMULATION; todos los entornos comparten el mismo contrato.
- La falta de configuración de activación o fiscal **no debe bloquear** pruebas unitarias, contractuales ni de integración que usen fixtures explícitos y dependencias simuladas. No se inventan configuraciones fiscales reales para superar esos tests.
- La ausencia o ambigüedad de configuración sí impide clasificar como REAL, habilitar writers reales o producir efectos fiscales/contables externos. El entorno de prueba debe marcar inequívocamente sus fixtures como sintéticos.
- `TransaccionesTPV` contiene intenciones comerciales pendientes/no contables. `MovimientosCaja` es el ledger físico canónico. `ControlOperativo` guarda locks/auditoría; `CajaActual` es proyección de sesión.
- `registrarVenta()` aplica las reglas de preparación antes de aceptar una operación real. Los tests deben cubrir tanto rechazo por gates reales como ejecución del mismo flujo de dominio con fixtures y puertos simulados.
- No se infiere cobro por la existencia de una intención. Pago verificado, movimiento físico y registro fiscal son etapas separadas.
- El borrado está prohibido para todas las colecciones. Los registros operativos/comerciales editables admiten actualización validada. Los ledgers fiscales/contables ya contabilizados, jornada y cierres se corrigen con eventos rectificativos trazables, sin sobrescribir evidencia legal.
- No se utilizan interruptores globales que deshabiliten writers por entorno. Cada operación atraviesa el mismo código y sus validaciones de dominio, autorización, configuración, idempotencia y concurrencia; los datos sintéticos se identifican por metadatos, no por un runtime alternativo.

## 4. Reservas

- Bookings V2 es la fuente de verdad del estado nativo de la reserva.
- `CitasF2` es proyección propia; las divergencias se resuelven mediante reconciliación backend auditable e idempotente, no mediante estados inventados ni actualizaciones manuales sin lectura de origen.
- Las pruebas de reconciliación usan fixtures/dobles y deben cubrir estados divergentes sin modificar reservas reales.

## 5. Seguridad y fiabilidad

- Comprobar autorización en cada WebMethod; no confiar en rol, identidad, precios, impuestos, totales o clasificación enviados por el cliente.
- Webhooks, jobs, writers y reintentos deben ser idempotentes y trazables.
- No asumir transacciones multi-documento de Wix Data; definir recuperación de proyección y reconciliación.
- No usar REST/CMS directo para saltarse DAL, hooks, permisos o writers canónicos.
- Los adaptadores simulados deben interceptar pagos, terminales, notificaciones, AEAT y demás efectos externos en pruebas.
- La seguridad se aplica por efecto y entorno: una prueba no necesita activar servicios reales para probar la lógica que los prepara.
- No borrar ningún registro. No alterar directamente ledgers contabilizados; corregirlos mediante registros rectificativos.

## 6. Capa 3

La preparación del paquete puede probarse con fixtures sintéticos y transporte simulado. El envío real exige autorización, destino configurado y control de acceso; no es precondición para probar transformación, minimización, checksum o contrato.

## 7. Estado de aceptación

El estado medible y los defectos abiertos están en [STATE-NOW](STATE-NOW.md) y [RELEASE-READINESS](RELEASE-READINESS.md). Distinguir pruebas estáticas, unitarias, integración simulada, Preview, Runtime y producción; no extrapolar un nivel a otro.
