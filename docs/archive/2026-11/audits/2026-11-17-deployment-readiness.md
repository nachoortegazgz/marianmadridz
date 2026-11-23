# Estado de preparación para despliegue — 2026-11-17

## Dictamen

**NO-GO**

El sitio sigue en Draft. Hay correcciones de código con CI offline en verde, pero no se han fusionado ni instalado en Wix. Los bloqueos P0 fiscales/operativos y las validaciones runtime impiden publicar.

## 1. Cambios completados

### Seguridad CMS live

- 19 colecciones operativas y TPV QA: lectura, inserción, actualización y eliminación `PRIVILEGED`.
- `ServiciosCatalogo` y `ComplementosCatalogo`: cuatro acciones `CMS_EDITOR`; se evita exposición pública de margen, coste y datos fiscales/contables.
- Read-back de las 21 colecciones confirmado.
- No se modificaron registros ni esquemas.

### Corrección del maestro fiscal — PR #418

[PR #418](https://github.com/nachoortegazgz/marianmadridz/pull/418)

- Código migrado desde la colección inexistente `DatosFiscales` al esquema físico live de `MapaStaff`.
- `MapaStaff`: 43 campos, revisión 135, 5 registros: 3 STAFF, 1 TERCERO/PROVEEDOR y 1 GESTORIA.
- No existe `CONFIG_SISTEMA`; no se ha creado un placeholder ni se ha inferido NIF/razón social del emisor.
- Los mapeos Bookings usan `recordType=STAFF`; se elimina el filtro por `active`, campo no declarado.
- Destinatarios de gestoría usan solo campos físicos; el registro actual carece de `emailFiscal`, por lo que no se ofrece como destinatario.
- CI offline: Layer 1 331/331; Layer 2 256/256; Secret scanning, SDK contracts, ESLint y regresión SUCCESS en el último SHA validado. El PR sigue abierto/no fusionado.

### Corrección de caja — PR #419

[PR #419](https://github.com/nachoortegazgz/marianmadridz/pull/419)

- Una fecha `closedAt` anterior a `openedAt` se trata como cierre de la sesión previa, no como cierre de la sesión actual.
- `sequenceCounters` se normaliza solo si es JSON válido que representa un objeto no-array.
- Se añaden pruebas de hooks y flujo E2E offline.
- CI offline: Layer 1 331/331; Layer 2 257/257; Secret scanning, SDK contracts, ESLint y regresión SUCCESS en el último SHA validado. El PR sigue abierto/no fusionado.

## 2. Bloqueos P0

### #415 — Maestro fiscal

[Issue #415](https://github.com/nachoortegazgz/marianmadridz/issues/415)

- `DatosFiscales` no existe (Wix WDE0025).
- No existe `CONFIG_SISTEMA`.
- La identidad legal del emisor y la configuración SIF deben ser proporcionadas/verificadas por el titular/asesoría.
- Mantener writers fiscales/contables deshabilitados hasta cerrar contrato, configuración y certificación.

### #416 — Compensaciones y caja

[Issue #416](https://github.com/nachoortegazgz/marianmadridz/issues/416)

- 3 compensaciones `FISCAL_LEDGER/PENDING_RECOVERY` apuntan a 2 pedidos POS existentes.
- Pedido A: servicio de 18,15 EUR, pago REFUNDED, reembolso el 2026-11-16. La reserva CitasF2 sigue CONFIRMED/PENDING_LEDGER y totalAmount=0. La compensación de refund espera al ledger original.
- Pedido B: pedido mixto (dos productos y un servicio), pago PAID de 92,45 EUR por Cash. La reserva CitasF2 sigue CONFIRMED/PENDING_LEDGER y totalAmount=0.
- CajaActual: ABIERTA; apertura y saldo efectivo 300 EUR, diferencia 0, ventas 0; MovimientosCaja=0. El pedido B se creó después de la apertura y no aparece en la proyección. Si es real, podría faltar un movimiento de caja.
- El propietario declara que los registros son sintéticos, pero no existen marcadores técnicos que acrediten la sinteticidad de estos pedidos. No se reintentó, borró ni rectificó nada.

## 3. Otros gates de despliegue

1. **Wix runtime:** no ejecutado tras las correcciones; falta Wix Local Editor, Preview/E2E y pruebas con roles reales.
2. **Sincronización:** no existe read-back que vincule el SHA de GitHub con el código instalado en Wix Editor Classic.
3. **GitHub:** `main` no tiene rulesets; GET rulesets devuelve lista vacía. La integración devuelve 403 al consultar branch protection por falta de scope administrativo. No fusionar hasta configurar required checks y aprobación.
4. **Bookings/Stores/TPV:** falta E2E real de reservas simples/duales, venta, cancelación, devolución/restock, TPV y pagos simulados.
5. **Automatizaciones:** siete activas PREINSTALLED; varias envían emails/notificaciones. No se ejecutaron ni desactivaron.
6. **Jobs:** 15 jobs declarados y 15 exports coincidentes; ejecución en Wix no acreditada.
7. **Fiscalidad:** SIF/VERI*FACTU y conexión AEAT no certificados.
8. **Capa 3:** no hay pipeline SharePoint/Power Automate completo; el conector SharePoint no está conectado y no se dispone de conector Power Automate operativo.
9. **Legal/UX:** revisión final de privacidad, cookies, accesibilidad, términos, precios/IVA y textos legales pendiente.

## 4. Reglas de integridad

- Ledgers fiscales, contables y laborales permanecen append-only e inmutables.
- No crear movimientos/asientos para cuadrar proyecciones ni marcar compensaciones como resueltas sin evidencia fuente.
- No habilitar pagos, writers fiscales, jornada laboral, reembolsos, comunicaciones ni automatizaciones externas durante QA.
- Wix CMS es SSOT transaccional; SharePoint solo repositorio documental cuando esté conectado.
- La Capa 3 no gobierna ni modifica Capa 1.

## 5. Próximos pasos en orden

1. Resolver #415 con identidad del emisor y configuración legal/SIF verificada.
2. Resolver #416: confirmar documentalmente si los dos pedidos POS son fixtures de QA; si no, conciliar pago, refund, caja y ledger con soporte fuente.
3. Configurar branch protection/ruleset y required checks en `main`.
4. Fusionar PR #418 y #419 solo después de los gates anteriores y revisión final.
5. Instalar/sincronizar el código en Wix y demostrar read-back del SHA.
6. Ejecutar pruebas runtime de permisos, hooks, WebMethods, Bookings, Stores, TPV, jobs y automatizaciones en entorno aislado.
7. Completar SIF/VERI*FACTU, privacidad y revisión legal.
8. Ejecutar Preview/Publish únicamente cuando el sitio, CI y runtime estén certificados.

## Evidencia relacionada

- [TEC-039, TEC-040 y TEC-041](../DECISION-LOG.md)

- [Auditoría CMS y permisos](2026-11-17-cms-permissions-hardening.md)
- [Revisión operativa live](2026-11-17-live-operational-recheck.md)
- [Contrato fiscal MapaStaff](2026-11-17-mapastaff-contract-reconciliation.md)
- [Correlación de compensaciones](2026-11-17-compensation-order-correlation.md)
- [Normalización CajaActual](2026-11-17-caja-session-normalization.md)
- [Diccionario CMS](../../DICCIONARIO_DATOS_CMS.md)
- [Registro de decisiones](../DECISION-LOG.md)
