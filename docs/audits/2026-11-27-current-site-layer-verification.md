# Auditoría de verificación del sitio y capas — 2026-11-27

## Alcance y método

Lectura directa del contexto Wix, estructura de páginas y colecciones CMS mediante APIs oficiales Wix REST. Lecturas de repositorio GitHub en `main`, código TPV y workflow Wix Preview. No se realizaron escrituras CMS, cambios de configuración, pagos, reservas, mensajes, remisiones fiscales, ni publicación.

Esta auditoría distingue:
- **Verificado en Wix:** valores devueltos por Site Context y APIs CMS en esta ejecución.
- **Verificado en GitHub:** archivos y commits de la rama `main`.
- **Verificado por CI:** resultados asociados a PR #640 y #641; no extrapolables a otros commits ni a runtime.
- **No verificado:** cualquier interacción del navegador, WebMethod online, hardware, sincronización Git-Wix o efecto externo que no se ejecutó.

## 1. Estado actual Wix

Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.

- Estado: **Draft**, `published=false`; Editor clásico; Velo habilitado; Premium.
- Región ES, idioma es, moneda EUR, zona `Europe/Madrid`.
- Apps identificadas: Blog, Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Payments, Stores Catalog V3 y SEO.
- Páginas: 9 estáticas y 2 dinámicas; ambas listas devuelven `published=false`.
- TPV: página ID `yl5th`, ruta `/blank`.
- Las APIs de estructura devuelven la presencia de las páginas, no que todos sus componentes, permisos, formularios o flujos funcionen.

## 2. Estado CMS leído directamente

Recuentos devueltos por Query Data Items con `returnTotalCount=true`:

| Colección | Registros |
|---|---:|
| CajaActual | 1 |
| MovimientosCaja | 5 |
| TransaccionesTPV | 0 |
| HistoricoCierresZ | 1 |
| ControlOperativo | 78 |
| CitasF2 | 11 |
| LibroAsientosContablesDetalle | 3 |
| MapaStaff | 5 |
| RegistrosHorariosStaff | 0 |

Hallazgos adicionales:
- `CajaActual` contiene una única sesión/singleton con estado `ABIERTA`. No se abrió, cerró ni reutilizó para pruebas.
- Los cinco registros de `MovimientosCaja` devuelven estado `SIMULATED_SUCCESS`; tres muestran `workDate=2026-11-23`. No se infiere que constituyan ventas cobradas o un cierre conciliado.
- `HistoricoCierresZ` contiene un cierre `SIMULATED`, `NOT_SIGNED`, de 2026-11-23.
- `TransaccionesTPV` está vacía.
- `RegistrosHorariosStaff` está vacía: la persistencia de jornada no está acreditada.
- `MapaStaff` contiene 1 registro `GESTORIA`, 1 `TERCERO` y 3 `STAFF`. No hay registro `recordType=CONFIG_SISTEMA` en la lectura actual. Ninguno de los cinco devolvió un valor `productionActivationAt`. Por tanto, el antiguo dato “cero registros de configuración” debe expresarse con precisión: hay cinco registros de identidad/terceros, pero falta el singleton de configuración del sistema/corte.
- La colección `LibroAsientosContablesDetalle` tiene 3 registros; el recuento no acredita integridad, validez fiscal ni envío.

No se inspeccionaron ni divulgaron datos personales o importes de registros operativos. No se modificó ningún registro.

## 3. Revisión de código TPV en main

Archivos leídos:
- `src/pages/TPV.yl5th.js`
- `src/public/tpvPageController.js`
- `src/backend/tpv/tpvVentas.web.js`
- `src/backend/tpv/tpvWriteV1Contract.js`

Hallazgos:
- La página Velo adjunta el controlador a `#htmlTPV`; si falta el HTML Component registra error y aborta la inicialización.
- El controlador importa WebMethods operativos de caja, ventas, movimientos, devoluciones, cierres, catálogo, permisos y auditoría; mantiene una allowlist explícita de tipos de mensaje y el fingerprint `TPV_BRIDGE_DIAGNOSTICS_2026-11-27`.
- La cotización se resuelve en backend a partir de catálogo Wix e impuestos; el navegador no es autoridad de precios/totales.
- `registrarVenta()` vuelve a resolver catálogo e impuestos y aplica validaciones de sesión, autorización, idempotencia y bloqueos antes de persistir una intención.
- El contrato V1 limita el medio a EFECTIVO/TARJETA, exige una única tasa verificable y conciliación exacta del importe aplicado.
- La propia ruta declara `paymentVerified=false`, y la preparación no declara persistencia. El código mantiene gates de presentación de precio final, fiscalidad, pago y política de inventario. No hay evidencia de cobro.
- La lectura CMS muestra cero intenciones en `TransaccionesTPV`; no se ha probado la ruta WebMethod online ni el bridge en navegador.

**Conclusión TPV:** el diseño y los contratos offline están integrados, pero no se certifica operación de caja, venta, pago, movimiento físico, devolución, Ticket X/Z ni bridge runtime.

## 4. CI y Wix CLI

- PR #640 integrada: CI reportada PASS, 81 suites / 764 tests.
- PR #641 integrada: CI reportada PASS, 80 suites / 762 tests.
- HEAD de `main` al iniciar esta auditoría: `21b905859d64bd9989103ac328331ef6147e19c6`, commit documental. No devuelve status checks ni workflow runs asociados; no se atribuye CI nueva a ese HEAD.
- `.github/workflows/wix-tpv-preview.yml` requiere `workflow_dispatch`, `create_preview=true`, rama `main` y secreto `CLI_API_KEY`. No se ha ejecutado en esta intervención.
- `scripts/wix-preview-smoke.mjs` bloquea métodos no-lectura y rutas API dinámicas; solo carga una página, valida respuesta HTTP y texto renderizado. Declara explícitamente cero interacciones y cero formularios. Es un smoke de disponibilidad/renderizado, no un E2E de negocio.
- No hay evidencia de sincronización del código Git con el Draft Wix ni de Preview/Runtime.

## 5. Páginas públicas

El rastreador público pudo leer `/reserva-online`, pero el contenido recuperado estaba fechado/caché de seis meses antes. `/inicio` no pudo recuperarse y `/blank` no fue accesible por el rastreador. Estos resultados no permiten afirmar que las rutas estén caídas ni que reflejen el Draft actual. La página pública de catálogo mostraba importes y una nota de precio estimado variable; requiere revisión actual de presentación de precio final antes de liberar ventas, conforme a la normativa de consumo aplicable.

## 6. Capas y objetivos: matriz de cumplimiento

| Capa / objetivo | Estado actual | Evidencia y límite |
|---|---|---|
| Wix sitio, páginas y apps | PARCIAL | Contexto y estructura leídos; Draft y páginas no probadas interactivamente |
| Capa 1 — CMS/SSOT | PARCIAL | Colecciones y recuentos leídos; falta CONFIG_SISTEMA y no se probaron writers/hooks online |
| Capa 1 — Bookings/reservas | NO VERIFICADO EN RUNTIME | 11 registros CitasF2; sin reconciliación con bookings nativos ni prueba de reserva/cancelación |
| Capa 1 — TPV/caja | NO-GO | Caja abierta; 0 intenciones TPV; no se ejecutaron WebMethods, pagos, movimientos ni cierres |
| Capa 1 — jornada laboral | NO-GO | 0 registros en RegistrosHorariosStaff; sin flujo de fichaje ni consulta de retención/acceso |
| Capa 2 — contabilidad/fiscal | BLOQUEADA CORRECTAMENTE | 3 asientos; falta CONFIG_SISTEMA; sin activación, writer fiscal ni envío real acreditado |
| Capa 3 — exportación | CONTRATO INTEGRADO, TRANSPORTE NO CONECTADO | PR #641 prepara paquete en memoria y exige registros REAL; no hay runtime, SharePoint ni Power Automate verificados |
| Seguridad/permisos/idempotencia | PARCIAL | Contratos y tests offline integrados; permisos, concurrencia, replay y hooks online no ejecutados |
| Cumplimiento legal | NO CERTIFICADO | Requiere revisión de precios finales, fiscalidad SIF, jornada, privacidad/retención y contratos reales de proveedores |

## 7. Correcciones y decisiones

No se encontró un fallo de código reproducible que justificara una modificación funcional segura sin ejecutar Wix Preview/Runtime. No se ha introducido un cambio especulativo ni se han abierto/cerrado cajas, creado reservas, alterado inventario o emitido pagos.

Corrección documental necesaria: la descripción de `MapaStaff` como “sin registros” era imprecisa. El estado correcto es cinco registros de identidad/terceros, sin `CONFIG_SISTEMA` ni `productionActivationAt` en la lectura actual. La auditoría y `STATE-NOW.md` se actualizan con esta precisión.

## 8. Plan mínimo para alcanzar aceptación real

1. Sincronizar el código aprobado de `main` con Wix Draft y ejecutar el workflow Preview; mantenerlo no publicador.
2. Ampliar el runner para pruebas de UI y WebMethods con identidad de QA y datos sintéticos, sobre la misma ruta de negocio; simular pagos/terminal y bloquear cualquier efecto externo.
3. Probar concurrencia de CajaActual, idempotencia, hooks CMS, apertura/venta/movimiento/cierre, Bookings y permisos; reset controlado de los datos sintéticos creados por la prueba.
4. Completar la configuración fiscal legal y el corte únicamente con fuente autorizada; no crear valores ficticios. Verificar que la política fiscal continúa fail-closed hasta entonces.
5. Validar precios finales mostrados al consumidor, jornada laboral, privacidad/retención y contratos de pagos/hardware.
6. Ejecutar exportación Capa 3 con fixture REAL controlado solo después de disponer de configuración fiscal válida; conectar transporte SharePoint/Power Automate en entorno aislado y verificar idempotencia y trazabilidad.

**Resultado global:** objetivos arquitectónicos y parte de los contratos de código están integrados y CI offline ha pasado en las PR citadas. El sitio actual está Draft y no existe evidencia Runtime. El ecosistema no cumple todavía el criterio de aceptación final ni está listo para liberar operación comercial.
