# Registro de decisiones de negocio y arquitectura — Marian Madrid

**Fecha de consolidación:** 2026-11-10  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Estado:** decisiones y límites documentados; no equivale a despliegue ni validación E2E.

Este registro centraliza las decisiones explícitas del propietario y las decisiones técnicas adoptadas para materializarlas. Las decisiones de negocio aprobadas por el propietario se distinguen de las recomendaciones técnicas derivadas y de los asuntos sujetos a revisión legal.

## 1. Decisiones de negocio

| ID | Decisión | Autoridad | Estado / criterio |
|---|---|---|---|
| BUS-001 | Exigir depósito solo cuando el precio del servicio sea estrictamente superior a 100 EUR. A 100 EUR exactos no se exige. | Propietario, 2026-11-10 | Aprobado |
| BUS-002 | El depósito es fijo: 15 EUR. No es porcentaje. | Propietario, 2026-11-10 | Aprobado |
| BUS-003 | El depósito se descuenta del precio total; no es una tarifa adicional. El saldo se liquida en el salón. | Propietario + diseño contrastado con Wix Bookings | Aprobado como política; conciliación de cobros/fiscalidad pendiente |
| BUS-004 | Ventana ordinaria de cancelación/reprogramación gratuita: al menos 24 horas. Si el negocio cancela, devolución íntegra. | Política operativa recomendada, basada en patrones de centros comparables y la política Wix existente de 1440 minutos | Adoptada para diseño; configuración real pendiente |
| BUS-005 | No retener automáticamente el depósito por cancelación tardía o inasistencia hasta redactar condiciones claras y obtener revisión jurídica de proporcionalidad. | Decisión prudencial de cumplimiento | Bloqueo preventivo; no activa retenciones |
| BUS-006 | No activar automatizaciones que contacten clientes (email, SMS, WhatsApp, campañas o mensajes automáticos). | Propietario, instrucción expresa | Prohibición operativa temporal |
| BUS-007 | Durante la auditoría/QA no realizar cargos reales, reservas de clientes, cambios de stock, escrituras CMS de producción ni publicación del sitio. | Alcance de autorización del propietario y controles del proyecto | Restricción activa |

### Base comparativa y jurídica de BUS-001…BUS-005

- Centros de estética/servicios consultados publican señales fijas de 15 EUR o 20 EUR que se descuentan del precio y reglas de cancelación de 24 horas. Son ejemplos individuales de prácticas comerciales, no una muestra estadística ni una norma jurídica: [Adara Essence](https://adaraessenceestetica.com/wp-content/uploads/2025/06/Carta-NUEVA-CAST.pdf), [Beassence](https://www.beassence.es/politicas), [Espai Gassó](https://www.espaigasso.com/politica-reservas-cancelaciones-y-devol).
- El texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios exige que las condiciones no creen desequilibrio importante ni impongan indemnizaciones desproporcionadas; el art. 62 también limita cargas onerosas/desproporcionadas en la terminación contractual. Por ello no se aprueba una cláusula de pérdida automática del depósito sin revisión: [BOE — RDL 1/2007, arts. 62 y 82](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
- El Código Civil regula cláusulas penales y libertad de pactos dentro de los límites legales: [BOE — Código Civil, arts. 1152–1155 y 1255](https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763). La política final debe ser revisada por asesoría jurídica; este registro no es dictamen legal.

## 2. Decisiones técnicas

| ID | Decisión | Justificación / consecuencia | Estado |
|---|---|---|---|
| TEC-001 | Wix Bookings nativo es la primera opción para depósitos. Configurar depósito fijo por servicio; no crear writer/checkout de depósitos propio mientras la capacidad nativa cubra el caso. | Wix Services V2 documenta `payment.options.deposit` y `payment.fixed.deposit.value` / `payment.varied.deposit.value`. | Adoptada; configuración y disponibilidad de la cuenta pendientes |
| TEC-002 | Los servicios sujetos a depósito deben usar pago online; si el depósito es inferior al total, habilitar pago presencial para el saldo. No ofrecer pago manual como alternativa de reserva con depósito. | Wix Help indica que depósitos se cobran online y la ruta manual no cobra depósito; la función puede no estar disponible en todas las cuentas. | Requiere QA de cuenta |
| TEC-003 | No combinar depósitos con aprobación manual de reservas. | Wix documenta incompatibilidad entre depósitos y aprobación manual. | Regla de configuración |
| TEC-004 | Clasificar precios y variantes antes de configurar depósitos. Si un servicio variable contiene variantes por encima y por debajo del umbral y Wix no permite condicionar el depósito por variante, separar servicios/variantes de forma nativa antes de considerar código custom. | Evita cobrar indebidamente a servicios ≤100 EUR. Wix admite tarifas fijas/variables y depósitos, pero no se ha demostrado en esta cuenta el comportamiento condicional por variante. | Pendiente de inventario de servicios |
| TEC-005 | Wix Stores Catalog V3 y las herramientas nativas Wix son la única autoridad operativa del stock comercial. | El checkout nativo valida disponibilidad y deduce inventario cuando el seguimiento está activado. | Aprobada |
| TEC-006 | No crear proyecciones CMS, reservas, deducciones, reposiciones, movimientos ni ajustes personalizados de stock. | Evitar doble autoridad, concurrencia y desincronización. | Aprobada; retirada de código pendiente |
| TEC-007 | Los módulos personalizados de inventario y la UI asociada se retiran por fases; no borrar consumidores sin búsqueda exhaustiva, análisis de webhooks, pruebas y rollback. | `events.js`, `inventario.web.js` y `ZONA MARIAN` tienen dependencias directas. | Pendiente de PR de código |
| TEC-008 | Los históricos `MovimientosInventario` existentes se preservan sin edición, borrado ni purga. No se insertan nuevos movimientos personalizados de stock. | La decisión de usar stock nativo no autoriza destruir evidencia histórica. | Aprobada |
| TEC-009 | El ledger fiscal/contable registra hechos económicos y rectificaciones trazables; no gobierna cantidades de stock. | Mantener separación entre economía/fiscalidad e inventario. | Aprobada |
| TEC-010 | La recuperación fiscal de pedidos pagados se limita a pedidos exclusivamente Bookings con payload fiscal original; pedidos Store/mixtos o legacy sin payload quedan en conciliación manual. | Evita reconstruir hechos fiscales incompletos o acoplar stock a ledger. Implementado en PR #235. | Fusionado; CI offline aprobada, runtime Wix pendiente |
| TEC-011 | No fusionar/publicar cambios críticos solo con CI offline; exigir pruebas positivas de integración/runtime, revisión de diff y rollback. | CI no certifica Velo runtime, webhooks reales ni Wix publicado. | Gate permanente |

### Fuentes técnicas oficiales Wix

- [Bookings Services V2 — pagos y depósitos](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/about-service-payments)
- [Wix Bookings — cobrar depósito online y saldo en persona](https://support.wix.com/es/article/wix-bookings-seleccionar-c%C3%B3mo-cobrar-los-servicios-de-reservas)
- [Wix Bookings — disponibilidad de depósitos porcentuales](https://support.wix.com/es/article/solicitud-de-wix-bookings-dep%C3%B3sitos-basados-en-porcentajes)
- [Stores Catalog V3 — gestión nativa de inventario](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/about-inventory-management)
- [Stores — flujo de compra y deducción automática](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/online-store-product-purchase-flow)

## 3. Evidencia de decisiones y artefactos

- [ADR de depósitos e inventario nativo](adr/2026-11-10-deposit-and-native-inventory.md)
- [Necesidades web y criterios de aceptación](../NECESIDADES%20WEB%20MARIAN.txt)
- [Dossier técnico consolidado](../DOSSIER%20TÉCNICO%20CONSOLIDADO.md)
- [Flujos end-to-end Capa 1 → Capa 3](../DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md)
- [Estado del proyecto](PROJECT-STATUS.md)
- [PR #235 — recuperación fiscal idempotente de pedidos pagados](https://github.com/nachoortegazgz/marianmadridz/pull/235)
- [PR #236 — documentación de depósitos e inventario nativo](https://github.com/nachoortegazgz/marianmadridz/pull/236)

## 4. Estados de validación

- **Verificado:** documentación Wix oficial confirma la capacidad nativa de depósitos y el descuento de stock en checkout nativo.
- **Verificado en lectura:** el sitio usa Stores Catalog V3 y tiene 30 inventory items con tracking en una ubicación; no se ha probado E2E.
- **Verificado en código:** el módulo custom de inventario aún está conectado a webhooks y UI.
- **Pendiente:** clasificación de 94 servicios Bookings por precio fijo/variable y variantes; configuración nativa de depósitos; pago/saldo/refund/ledger E2E en QA; retirada del módulo de inventario.
- **No autorizado:** activar comunicaciones a clientes, cobros reales, cambios de datos o stock en producción y publicación.

---
*Actualizado 2026-11-10. Toda decisión futura que altere importes, umbrales, tratamiento de cancelaciones, autoridad de datos o contratos debe añadirse aquí y al ADR afectado.*
