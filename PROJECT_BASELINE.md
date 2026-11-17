> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](docs/qa/QA-ENVIRONMENT-SSOT.md).

---

# Base maestra del proyecto — Marian Madrid

**Vigencia:** 2026-11-14 · addendum operativo QA  
**Sitio QA único:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.  
**Plataforma confirmada:** Wix Editor Classic + Velo.  
**Repositorio:** https://github.com/nachoortegazgz/marianmadridz

Este documento describe un único sitio objeto de trabajo. No se mantiene una matriz comparativa de entornos. Los registros presentes deben considerarse sintéticos hasta que exista evidencia expresa en contrario.

## Addendum de decisión y estado de QA — 2026-11-14

- **Decisión expresa y SSOT del propietario:** el sitio `188bed94-177c-4bc9-a9f0-35080d874f3e` es el único entorno QA, con datos sintéticos, cliente de prueba Nacho Pitt (`nachoortegazgz@gmail.com`) y pasarela desconectada. Nunca ha tenido actividad real. No existe otro sitio QA ni QA externo.

- **Continuidad de trabajo:** avanzar con pruebas offline/mock, fixtures sintéticos, auditoría estática, CI y correcciones. Runtime/E2E con efectos externos no se considera validado hasta comprobar cada ruta de salida.
- **Pagos:** usar adaptador mock local sin red, sin PSP, sin Wix Payments y sin banco. `TEST_PAYMENT_CONFIRMED` solo es un resultado interno de simulación.
- **Comunicaciones y gestoría:** sinks offline sin entrega. No emitir facturas/tickets reales ni invocar AEAT/Veri*Factu, SharePoint o Power Automate desde escenarios QA.
- **Datos:** no importar PII. Emails bajo `.example.test`; no utilizar teléfonos operativos. Los datos de gestoría son fixtures internos no válidos para procesos fiscales.
- **Mutaciones:** la autorización/documentación de mutaciones QA no habilita por sí sola los writers fiscales/contables/laborales, pagos, reembolsos o efectos externos, que conservan sus gates independientes.

El plan ejecutable, escenarios y criterios de evidencia están en [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md). Este addendum prevalece sobre frases anteriores de este documento que presenten el aislamiento como verificado o permitan inferir acceso runtime.

## 1. Estado actual verificado

### Git y Wix
- Rama de referencia: `main`, con PR #361–#366 integradas; último merge `13b9ae095214e0c601f255fa75d629680c539933`. PR #367 (`fix/current-site-cms-field-alignment`): CI offline PASS, run #1137 (69 suites, 631 tests), secret scanning PASS #561; integrada en main mediante merge `dfdee00d8ebc535427c95d49cae91b4c557e4209`.
- CI offline, contratos SDK, ESLint y secret scanning de las cuatro intervenciones: PASS (runs #1122, #1124, #1126, #1128; secret scanning #546, #548, #550, #552).
- GitHub es la referencia del código versionado, no prueba del código ejecutado por Wix.
- La correspondencia entre los archivos Velo del Editor Classic y Git no está verificada.
- No existe evidencia de release Wix que vincule runtime con un SHA de Git.
- No se ha autorizado publicación ni conexión a operaciones reales.
- No se ha publicado código Wix en esta intervención.


### CMS
- 23 colecciones: 15 NATIVE y 8 WIX_APP.
- 524 campos físicos en colecciones NATIVE.
- 140 registros en las colecciones propias en el corte leído.
- El inventario completo y los tipos físicos vigentes están en `docs/audits/2026-11-14-current-site-cms-normalization.md`; el diccionario raíz enlaza ese corte y marca los bloques anteriores como históricos.
- `CajaActual`: 39 campos, 1 registro; operationDate DATE, openingAmount NUMBER y sequenceCounters OBJECT. cashRegisterStatus=SIMULACION; isOpen=true es inconsistente y no gobierna sesión. id=_id y currentSequence=0 son candidatos de retirada tras revisar consumidores externos.
- `ControlOperativo`: 42 campos, 0 registros; `ownerToken` no existe. `traceId` es el token de fencing canónico.
- `ComplementosCatalogo`: 18 campos, 36 registros; `addonId = _id` en todos. `traceId` está vacío. `name = description` en todos los registros, pero los tipos TEXT/RICH_TEXT y el uso de presentación son distintos; no borrar sin revisar UI y consumidores.
- `MapaStaff`: 18 campos, 3 registros; maestro exclusivo de identidad staff. El código valida `staffMemberId`, `resourceId`, `scheduleId` y los IDs opcionales `memberId`/`thirdPartyId`; no exige `recordType`, `traceId` ni campos fiscales. `resourceId = _id` en los tres registros, pero no se fusionan: el primero es ID nativo de recurso Bookings y el segundo ID CMS.
- `DatosFiscales`: 28 campos, 1 registro sintético placeholder; maestro fiscal canónico para `recordType`, `taxId`, `legalName`, `thirdPartyType`, `address` y datos de gestoría. `gestorName` y `gestorNombre` coinciden; el código usa solo `gestorName`. `taxId` está informado y `nif` vacío; `name`/`legalName` difieren y `gestorEmail`/`email` tienen funciones distintas. No existe `traceId` ni `schemaVersion`; el código deja de persistirlos.
- `ServiciosCatalogo`: 42 campos, 95 registros (94 SERVICE y 1 PRICING_PLAN). `serviceId` y `pricingPlanId` son IDs nativos distintos de `_id` CMS. No fusionar identidades diferentes.
- `RegistrosHorariosStaff`: 21 campos, 2 filas sintéticas sin firma; no acreditan jornada real.
- `InventarioStockVenta` y `MovimientosInventario` están presentes físicamente en este sitio, pero sus contratos/writers están retirados. Su presencia no autoriza reactivar inventario custom: Stores Catalog V3 sigue siendo la autoridad prevista para stock comercial.

### Mutabilidad y seguridad
- Se han retirado del código los bypasses globales de update/remove y la ventana temporal append-only; no existe un flag que pueda abrirlos desde configuración.
- Los ledgers MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ, RegistrosHorariosStaff y PaquetesGestoria permanecen append-only también en QA.
- CajaActual es una proyección mutable únicamente a través del flujo backend autorizado y vinculada a movimientos fuente; no se habilita su borrado.
- Bulk update está deshabilitado. Bulk remove solo admite purgas condicionadas por tipo, estado terminal y fecha de expiración/retención en ControlOperativo; WEBHOOK_EVENT y claims durables están excluidos.
- La identidad QA no está acreditada por la conexión Wix actual; no existe todavía una barrera runtime por Site ID. Las colecciones WIX_APP se operan exclusivamente mediante sus APIs oficiales y los efectos externos siguen fail-closed.

## 2. Alcance funcional

La web debe apoyar la operativa del salón:
1. Reservas online y disponibilidad fiable.
2. Servicios por fases con huecos de exposición y solapamiento controlado cuando el modelo Bookings lo permita.
3. Anticipos, cancelaciones, pagos y reembolsos solo tras validar contratos Wix y el flujo fiscal.
4. Catálogo y venta mediante Wix Stores; stock gobernado por Stores Catalog V3.
5. Área de cliente, contenidos y comunicación conforme a capacidades nativas y consentimientos válidos.
6. Asistencia capilar automatizada con límites de seguridad, privacidad y supervisión profesional.
7. Registros fiscales, contables y laborales conformes con normativa aplicable; no afirmar cumplimiento hasta validación técnica y profesional.
8. Exportación documental y eventual archivo de evidencia en SharePoint.

Los requisitos funcionales son declaraciones de alcance, no prueba de implementación o certificación legal.

## 3. Directrices de arquitectura

- Mejorar el sistema existente; no reconstruir ni introducir funciones sin necesidad demostrada.
- Wix CMS es SSOT transaccional. SharePoint es repositorio documental de evidencias. Capa 3 no gobierna ni modifica Capa 1.
- Frontend de presentación; lógica de negocio en backend/WebMethods.
- Constantes en `internalConfig.js`; validaciones compartidas en `validation.js`.
- Permisos y autorización en backend. Secretos nunca en frontend.
- Webhooks y procesos asíncronos idempotentes.
- Contratos oficiales de Wix e integraciones prevalecen sobre ejemplos antiguos.
- No eliminar campos/símbolos sin búsqueda de consumidores, pruebas y revisión del diff.
- Distinguir verificado, declarado, inferido y pendiente.
- CI offline no equivale a runtime Wix ni E2E.
- Cambios mínimos, PR delimitada, CI verde, diff revisado y reversión documentada.
- No publicar/desplegar sin autorización expresa.

## 4. Prioridades

- **P0:** integridad fiscal, seguridad crítica y pérdida de datos.
- **P1:** reservas, pagos, concurrencia, ledgers y jornada laboral.
- **P2:** integraciones, automatizaciones y exportaciones.
- **P3:** rendimiento, mantenibilidad y deuda técnica.
- **P4:** mejoras evolutivas aprobadas.

## 5. Bloqueos abiertos

0. Mantener el Site ID QA único `188bed94-177c-4bc9-a9f0-35080d874f3e` como destino de validación. No designar un segundo QA ni un QA externo. Las pruebas con efectos externos permanecen offline/mock hasta verificar sus controles.


1. Probar en Wix Local Editor y ejecutar E2E; la integración en Git está cerrada, el despliegue Wix no.
2. Probar en Wix Editor los hooks de MapaStaff y DatosFiscales, junto con las lecturas de identidad fiscal y destinatarios de gestoría.
3. Completar búsqueda de consumidores para los candidatos físicos: CajaActual.id, ComplementosCatalogo.addonId, DatosFiscales.gestorNombre y ComplementosCatalogo.traceId.
4. Mantener MapaStaff.resourceId porque no es semánticamente equivalente a _id CMS, aunque los valores actuales coincidan.
5. Obtener exportación reproducible de Velo desde Editor Classic y comparar con Git.
6. Ejecutar E2E en el sitio aislado antes de cualquier autorización de actividad real.

## 6. Fuentes de referencia

- `DICCIONARIO_DATOS_CMS.md`: índice y contexto histórico del esquema.
- `docs/audits/2026-11-14-current-site-cms-normalization.md`: inventario live vigente, tipos y hallazgos de normalización.
- `ESTADO_ACTUAL_PROYECTO.md`: resumen operativo.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: arquitectura y contratos detallados; validar cada sección contra el CMS actual.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: diseño documental; no implica operación certificada.
- `NECESIDADES WEB MARIAN.txt`: requisitos declarados, no estado técnico.
- `DIRECTRICES_DESARROLLO_CODIGO.md`: directrices raíz vigentes.
- `PLAN_ACCION_QA.md`: fases, simuladores, escenarios, gates y registro de ejecución.

## 6. Estado de la rama de alineación

- Rama de trabajo: fix/current-site-cms-contract-alignment.
- Alcance: separación de contratos MapaStaff / DatosFiscales, keyfield _id para complementos, validación de tipos y actualización documental.
- Estado: cambios en rama, pendientes de CI, revisión de diff y PR.
- No se han ejecutado mutaciones CMS, migraciones de registros ni publicación Wix.


## Addendum de estado live — 2026-11-17

Este addendum prevalece sobre cualquier snapshot anterior cuando exista contradicción con evidencia Wix live posterior.

### Estado real de Wix y sincronización

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor Classic; Velo habilitado.
- `GetSiteContext` consultado el 2026-11-17 devuelve **Draft**. No se ha ejecutado Preview ni Publish.
- La declaración histórica de que el código está publicado no queda acreditada por un identificador de publicación ni por read-back del SHA. Se clasifica como declaración del propietario, no como hecho verificado.
- La integración disponible no permite leer/escribir el código fuente Velo del Editor Classic ni confirmar sincronización GitHub↔Wix.

### CMS y maestro fiscal

- Inventario live: 50 colecciones (21 NATIVE, 29 WIX_APP); 201 registros NATIVE en el corte consultado.
- `DatosFiscales` no existe (Wix WDE0025).
- `MapaStaff` es NATIVE, 43 campos, revisión 135 y 5 registros: 3 STAFF, 1 TERCERO/PROVEEDOR y 1 GESTORIA. No existe `CONFIG_SISTEMA`.
- Contrato vigente propuesto: `MapaStaff` discriminado por `recordType` (STAFF/TERCERO/GESTORIA/CONFIG_SISTEMA). TEC-035 queda supersedida por TEC-039 y la evidencia live.
- La fila GESTORIA no tiene `emailFiscal`; no se puede enviar documentación a gestoría hasta que se configure un correo verificado.
- `ServiciosCatalogo` y `ComplementosCatalogo` tienen lectura/escritura CMS_EDITOR. Las 19 colecciones operativas y TPV QA tienen las cuatro acciones PRIVILEGED. Read-back confirmado.

### Caja, compensaciones y pedidos POS

- `ControlOperativo` mantiene 3 compensaciones FISCAL_LEDGER en PENDING_RECOVERY.
- Las tres compensaciones se correlacionan con dos pedidos POS Wix: uno de servicio totalmente reembolsado por 18,15 EUR y otro pedido mixto pagado en efectivo por 92,45 EUR.
- La reserva asociada a cada pedido permanece CONFIRMED/PENDING_LEDGER con totalAmount=0.
- El pedido POS en efectivo no aparece en MovimientosCaja (0) ni en la proyección de caja (salesCount=0; cashAmount=openingCashAmount=300 EUR). El propietario declara que los datos son sintéticos, pero no hay marcador técnico que acredite la sinteticidad de estos dos pedidos.
- `CajaActual` permanece ABIERTA. `closedAt` es anterior a `openedAt`; `sequenceCounters` se devuelve como JSON string aunque el esquema lo declara OBJECT. PR #419 prepara la corrección, sin modificar el singleton live.
- No se han reintentado compensaciones, creado movimientos, asientos, reembolsos ni cierres.

### Código, CI y despliegue

- PR #418: alineación de MapaStaff/fiscal y consumidores; CI offline verde (Layer 1: 331/331; Layer 2: 256/256; Secret scanning, SDK contracts y ESLint SUCCESS).
- PR #419: normalización de sesión de caja y sequenceCounters; CI offline verde (Layer 1: 331/331; Layer 2: 257/257; Secret scanning, SDK contracts y ESLint SUCCESS).
- Ambos PR siguen abiertos y no fusionados. No se ha ejecutado Wix runtime ni E2E publicado.
- `main` no tiene rulesets configurados; GET rulesets devuelve lista vacía. La integración no dispone de permisos administrativos para crear branch protection/required checks. No fusionar ni publicar hasta resolver este control.

### Fiscalidad, automatizaciones y Capa 3

- Writers fiscales, contables y laborales siguen deshabilitados. No existe CONFIG_SISTEMA y SIF/VERI*FACTU no está certificado.
- Siete automatizaciones activas PREINSTALLED, bloqueadas por Wix; algunas envían emails/notificaciones. No se ejecutaron ni modificaron.
- No está acreditado un pipeline Capa 3 completo SharePoint/Power Automate. El conector SharePoint no está instalado/conectado y no se dispone de conector Power Automate operativo.

### Inmutabilidad

Las instrucciones vigentes del proyecto mantienen los ledgers fiscales, contables y laborales como append-only e inmutables. Cualquier texto histórico que suspenda genéricamente append-only durante QA queda subordinado a esta regla vigente. No se borran ni sobrescriben movimientos, asientos, cierres ni evidencias; las correcciones económicas requieren nuevos registros rectificativos trazables.

**Estado de publicación: NO-GO.** Bloqueos P0: issues #415 y #416. Validación runtime, protección de main, configuración legal/SIF y reconciliación económica pendientes.
