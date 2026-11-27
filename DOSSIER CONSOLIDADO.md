# DOSSIER CONSOLIDADO — MARIAN MADRID

**Estado:** resumen ejecutivo de entrada, ACTIVO.  
**Vigencia:** 2026-11-28.  
**No es una fuente paralela de contratos ni de estado:** la documentación especializada enlazada es la autoridad de cada dominio.

## Identificación

- Sitio: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Plataforma: Wix Editor clásico + Velo.
- Región: España · idioma español · EUR · `Europe/Madrid`.
- Repositorio: `nachoortegazgz/marianmadridz`, rama `main`.
- Estado documentado: Draft / no publicado. MVP operativo/comercial NO-GO.

## Objetivo

Completar y mantener el MVP funcional de reservas, TPV, checkout, pagos, cierres, contabilidad, fiscalidad, jornada laboral e integraciones, con integridad transaccional, seguridad, trazabilidad y cumplimiento. Proteger y mejorar el sistema existente mediante cambios mínimos; no reconstruir módulos funcionales por preferencia técnica.

## Arquitectura

- Capa 0: configuración, seguridad, validación, normalización, errores, DAL, logging y utilidades compartidas.
- Capa 1: reservas mediante Wix Bookings V2.
- Capa 2: TPV, checkout, pagos, caja, cierres, contabilidad, fiscalidad y jornada laboral.
- Capa 3: auditoría y trazabilidad observacional; no gobierna ni modifica capas 1 y 2.
- Wix Apps gobierna sus dominios nativos. Wix CMS es SSOT de entidades propias. Git es SSOT del código versionado. SharePoint custodia evidencias.
- Frontend presenta e interactúa; backend/WebMethods ejecuta negocio, autorización, validación y persistencia.

## Invariantes esenciales

1. Un único código y contrato de dominio para desarrollo, pruebas y producción. Fixtures/adaptadores sustituyen efectos externos, no reglas de negocio.
2. No hay bloqueos globales por entorno ni bloqueos fiscales preventivos genéricos. Cada operación valida sus precondiciones reales.
3. Sin secretos en frontend/repositorio. Autorización siempre en backend.
4. Webhooks, jobs, writers y reintentos idempotentes y trazables; no repetir automáticamente efectos inciertos.
5. `transactionId` obligatorio en writers de transacciones económicas donde el contrato lo requiere; no inventar sustitutos.
6. Ledgers fiscales, contables, laborales, movimientos contabilizados y cierres finalizados append-only; rectificaciones mediante nuevos registros trazables.
7. No convertir silenciosamente fallos o entradas inválidas en éxito, ausencia o cero.
8. Durante pruebas: cero cobros, reembolsos, remisiones fiscales, notificaciones o efectos externos reales. No reutilizar la caja singleton ABIERTA ni históricos como fixtures.
9. No publicar ni habilitar actividad productiva sin autorización expresa.

## Contratos de dominio

### Reservas
Bookings V2 es autoridad de servicios, disponibilidad, profesionales/recursos, reservas y estado nativo. `CitasF2` conserva correlación/proyección reconciliable. En reserva dual F1 + exposición + F2 se utiliza el mismo profesional en ambas fases; durante la exposición se libera su agenda.

### TPV y caja
- `TransaccionesTPV`: intención comercial; no acredita cobro ni movimiento físico.
- Pago verificado: evidencia independiente de la pasarela.
- `MovimientosCaja`: ledger físico canónico.
- `CajaActual`: proyección de sesión.
- `ControlOperativo`: locks, idempotencia técnica y auditoría.
- `HistoricoCierresZ` y registros contables/fiscales/laborales: evidencias append-only según contrato.

## Navegación canónica

- [Guía de entrada IA](docs/AI-ENTRYPOINT.md)
- [Índice IA](docs/AI-INDEX.md)
- [Estado actual](docs/STATE-NOW.md)
- [Canon de arquitectura](docs/PROJECT-CANON.md)
- [Contrato TPV](docs/TPV-UNIFIED-FLOW.md)
- [Release readiness](docs/RELEASE-READINESS.md)
- [Esquema CMS](docs/ESQUEMA_CMS.md)
- [Índice documental](docs/INDEX.md)
- [Archivo histórico](docs/ARCHIVE-MANIFEST.md)

**Regla de evidencia:** documentación acredita decisiones/contratos; código acredita implementación; tests acreditan comportamiento offline; Preview/Runtime y producción requieren ejecución específica. No son equivalentes.
