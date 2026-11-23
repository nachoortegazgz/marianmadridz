# TPV — matriz de aceptación funcional y conciliación con Wix nativo

**Fecha:** 2026-11-23  
**Base vigente:** main `956356db48ee9d0ba363023c14105474316f84dd` (PR #541, #540 y #542 integradas)  
**Alcance:** `#htmlTPV.txt`, `src/public/tpvPageController.js`, WebMethods TPV, seguridad, persistencia y pruebas de contrato.  
**Naturaleza:** auditoría estática y definición de pruebas. No equivale a una prueba Wix Runtime ni autoriza pagos, facturación o despliegue.

## Criterio de estado

- **VERIFICADO (estático):** el contrato se observa en el código y tiene una comprobación automatizada.
- **PARCIAL:** hay una parte implementada, pero falta una relación, campo, flujo o prueba.
- **NO IMPLEMENTADO / BLOQUEADO:** no existe código activo o la política actual lo deshabilita.
- **PENDIENTE RUNTIME:** requiere Wix Preview/Editor, CMS real, identidad/roles de prueba o entorno Published.

## 1. Diagnóstico de arquitectura y contratos actuales

### 1.1 Identidad Wix y operador seleccionado

**VERIFICADO (estático):**
- `backend/security.js` obtiene el miembro autenticado mediante `members.getCurrentMember()`.
- La identidad staff se resuelve mediante el `contactId` del miembro y `findStaffByContactId`; el rol procede de `staff.roleWebsite`.
- `tpvOperatorContext.js` construye `actorId` y `operatorId` desde el `memberId` autenticado. No acepta identificadores de actor enviados por el widget.
- Los WebMethods de escritura vuelven a resolver el contexto en backend; el `operatorId` del navegador no es la fuente de identidad.

**PARCIAL — bloqueo funcional de conciliación:**
- El widget selecciona `profesionalId` desde `CATALOG_STAFF` y lo guarda como `state.profesionalId`.
- `tpvCatalogo.web.js` deriva ese identificador de `staff.identityId` (identidad Staff sintética) y expone `resourceId` con el mismo valor; no es el `resourceId` real que devuelve `getMyStaffContext` desde la ficha Staff de Wix Bookings.
- El controlador del candidato PR #538 adapta `lineItems/payments` a `lineas/pagos` y reenvía `profesionalId`; también adapta la apertura usando `openingCash` al contrato de `abrirSesionCaja`.
- El backend valida que el profesional solicitado pertenece a la lista de identidades Staff sintéticas permitidas, pero no existe una relación comprobada entre esa identidad sintética y el `operatorResourceId` real del miembro Wix autenticado.
- Por tanto, la identidad autenticada no se suplanta desde el navegador, pero tampoco queda demostrada la regla «profesional seleccionado = empleado autenticado/autorizado». No se debe presentar el selector como login ni como prueba de autorización.

**Aceptación pendiente:** definir un mapeo canónico y verificable entre identidad Staff sintética y recurso Staff real; con cuentas Wix distintas, intentar enviar un `profesionalId` de otra persona y exigir rechazo del mismatch. Persistir identidad Wix y recurso Staff autorizado en campos diferenciados.

### 1.2 Roles y permisos

**VERIFICADO (estático):**
- Roles canónicos actuales: `ADMIN`, `GESTION`, `ESTILISTA`.
- `requireCajero` permite ADMIN y GESTION; `requireAdmin` solo ADMIN.
- Lecturas como estado de caja, resumen e historial requieren `requireCajero`.
- Apertura, venta, movimientos, devolución, Control X y cierre Z usan `requireAdmin`.
- `obtenerPermisosTPV` expone capacidades de escritura únicamente para ADMIN.

**PARCIAL frente a la matriz solicitada:** no existen roles independientes CAJERO y SUPERVISOR ni la matriz diferenciada Cajero/Encargado/Supervisor/Administrador. GESTION tiene lectura, pero no los permisos de operación de caja descritos en esa propuesta. No se debe ampliar permisos por conveniencia sin definir y aprobar la correspondencia con `ROL_WEBSITE`.

### 1.3 Sesión de caja

**VERIFICADO (estático):**
- La apertura registra `sessionId`, `status`, `openedAt`, `openingCashMinor`, `cashierMemberId`, `actorId` y `operatorId`; `terminalId` se guarda dentro del payload.
- Las operaciones de venta, movimiento, devolución y cierre buscan una sesión abierta y usan lock por sesión.
- El cierre Z registra `closedByMemberId`, marca `closed: true` y la consulta de sesión abierta excluye las sesiones cerradas.

**PARCIAL:**
- El identificador de sesión se deriva del día de Madrid; `terminalId` no forma parte de la identidad de sesión.
- No se observa un estado de sesión `BLOQUEADA` ni un estado explícito de cierre en el mismo registro de apertura; el cierre se proyecta desde el evento Z.
- La sesión guarda identidad Wix, pero no la asociación verificada al profesional seleccionado en el widget.

### 1.4 Ventas, pedidos y recibos nativos

**NO IMPLEMENTADO / BLOQUEADO por política actual:**
- En el candidato PR #538, el controlador adapta el contrato del widget (`lineItems/payments`) al DTO backend (`lineas/pagos`); la apertura también usa el nombre canónico `openingCash`. Estas adaptaciones quedan protegidas por la suite de contrato.
- `SALE_REGISTER` crea eventos sintéticos propios: venta preparada/confirmada, líneas y pagos.
- La respuesta devuelve `saleId` y `ticketId` propios, no un `orderId`, `nativeReceiptId` ni `invoiceId` Wix.
- El backend declara `fiscalLedgerWritten: false`; `ALLOW_NATIVE_WRITES` y `ALLOW_REAL_PAYMENTS` son false.
- No se observa creación/vinculación de pedido o recibo nativo en este flujo. La reserva nativa está expresamente bloqueada en la venta TPV.

**Aceptación pendiente:** no marcar venta como conciliada con Wix nativo hasta que exista una integración autorizada, un ID nativo persistido y una prueba de lectura de vuelta. La prueba actual debe confirmar que no se crean pedidos, cobros ni documentos fiscales reales.

### 1.5 Pagos divididos y conciliación

**VERIFICADO (estático):**
- La validación opera en céntimos, comprueba el importe aplicado, cambio solo en efectivo y evita sobrepagos.
- El desglose se calcula por medio y se persiste en los eventos de venta/pago.
- Métodos admitidos hoy por backend: `EFECTIVO`, `TARJETA`, `BIZUM`, `OTROS`.
- El resumen calcula por separado efectivo, tarjeta, Bizum y otros; efectivo esperado = apertura + efectivo neto + entradas - salidas.

**VERIFICADO ESTÁTICAMENTE — métodos sintéticos:** `BONO` y `TARJETA_REGALO` forman parte de `TPV_PAYMENT_METHOD`; el validador acepta el enum centralizado, la conciliación separa ambos importes y las devoluciones conservan las asignaciones por medio original. Esto solo acredita su registro como medio de pago sintético. **NO IMPLEMENTADO:** consumo de saldo, integración transaccional con Wix Gift Cards, pasivo contable del bono, autorización/captura de valor real ni conciliación con un proveedor. No interpretar estos medios como canje real.

**Aceptación pendiente:** venta mixta, efectivo con cambio, rechazo de sobrepago, devolución parcial por cada método y conciliación exacta contra el ledger. Un medio no confirmado no debe incrementar el importe cobrado.

### 1.6 Entradas y salidas

**VERIFICADO (estático):**
- `CASH_MOVEMENT` acepta ENTRADA/SALIDA/RETIRADA, exige sesión abierta, motivo, importe positivo, clave idempotente y lock de sesión.
- El movimiento se clasifica como `EFECTIVO` y `affectsPhysicalCash: true`; por tanto, solo modifica el cajón físico.
- El resumen integra entradas y salidas en el efectivo esperado.

**Decisión de dominio:** no ofrecer selector de tarjeta/Bizum/bono en entrada/salida del cajón físico. Si negocio necesita movimientos financieros no monetarios, deben ser un tipo de movimiento financiero separado y no afectar a `expectedCash`.

**PARCIAL:** el evento de auditoría de movimiento no incluye explícitamente `sessionId` en su payload actual; debe añadirse al contrato antes de considerar conciliación completa.

### 1.7 Informe X

**VERIFICADO (estático):**
- X obtiene resumen de la sesión, persiste informe, registra auditoría y devuelve `closesSession: false`.
- Se ejecuta bajo lock y no cierra la sesión.

**PARCIAL:**
- El resumen separa los seis métodos sintéticos canónicos (`EFECTIVO`, `TARJETA`, `BIZUM`, `BONO`, `TARJETA_REGALO`, `OTROS`) y calcula efectivo esperado. La enumeración procede de `internalConfig.js`; no debe duplicarse como lista divergente en validadores.
- No recoge efectivo contado ni diferencia; tampoco incluye una referencia explícita a un arqueo opcional.
- El documento X no contiene por sí mismo el actor; el actor aparece en la auditoría.
- No se demuestra vínculo desde Z al ID del último X.

### 1.8 Cierre Z

**VERIFICADO (estático):**
- Se ejecuta bajo lock de sesión.
- Bloquea el cierre si hay ventas o devoluciones pendientes o si falla la conciliación.
- Persiste efectivo contado, esperado y diferencia; registra `closedByMemberId`, `operatorId`, `closed: true` y evento de auditoría.
- Usa clave idempotente determinista por sitio/sesión y detecta conflictos de repetición.

**PARCIAL:** no se demuestra vínculo explícito del Z con el informe X ni un conjunto/listado inmutable de los IDs exactos incluidos en el corte. Debe comprobarse además el comportamiento de dos operadores intentando cobrar/cerrar simultáneamente en Runtime.

### 1.9 Historial y auditoría

**VERIFICADO (estático):**
- El repositorio crea eventos de auditoría con acción, actor, entidad, referencia, fecha/hora, origen y traceId.
- Hay auditoría de apertura, venta, movimientos, devolución, X y Z.
- Los eventos se insertan por la ruta append-only.

**PARCIAL / GAP:**
- No todas las auditorías contienen `sessionId` de forma explícita: apertura, movimiento y devolución requieren revisar/normalizar el payload.
- `AUDIT_LIST` del widget se resuelve actualmente mediante `obtenerMovimientosCaja` de `tpvMovimientos.web.js`: muestra movimientos/proyección del ledger, no los eventos de la colección de auditoría. El WebMethod de `tpvAuditoria.web.js` no está conectado al controlador de página.
- `AUDIT_LIST` y `SESSION_SUMMARY` son lecturas sin evento de auditoría de consulta.
- No existen exportaciones de movimientos/auditoría en el contrato activo revisado.
- La impresión del último ticket es local (`window.print()`) y no registra un evento de auditoría.
- No se observa registro persistente de intentos rechazados por permisos. El log de backend no sustituye al ledger de auditoría.

### 1.10 Tickets y Veri*Factu

**NO IMPLEMENTADO / BLOQUEADO:**
- La política declara `fiscalEmission: false` y `ALLOW_NATIVE_WRITES: false`.
- La venta declara `fiscalLedgerWritten: false`.
- No existe en el flujo revisado una respuesta `verifactuQrUrl`, número/serie fiscal o referencia de factura emitida.
- El widget no debe generar ni presentar un QR ficticio.

**Aceptación pendiente:** integración fiscal oficial autorizada, evidencia de alta/configuración en España, respuesta del proveedor/sistema fiscal, persistencia inmutable de los identificadores y QR oficial, y pruebas fiscales en entorno legalmente habilitado. No se habilita emisión ni se simula conformidad Veri*Factu.

## 2. Matriz de pruebas funcionales obligatorias

| ID | Escenario | Resultado exigido | Estado |
|---|---|---|---|
| TPV-AUTH-01 | Miembro no autenticado | Denegado por Wix/WebMethod | Pendiente Runtime |
| TPV-AUTH-02 | Miembro autenticado sin ficha Staff válida | Denegado; cero escrituras | Parcial estático / Runtime pendiente |
| TPV-AUTH-03 | GESTION, ADMIN y ESTILISTA | Resultado según roles canónicos; ningún permiso por UI solamente | Pendiente Runtime |
| TPV-AUTH-04 | Widget envía operatorId de otro profesional | Backend rechaza mismatch; no suplanta actor | GAP de implementación |
| TPV-SES-01 | Apertura | Usuario Wix, operador autorizado, sesión, fecha, saldo y terminal correlacionados | Parcial |
| TPV-SES-02 | Venta/movimiento sin sesión abierta | Rechazo sin escritura | Verificado estático / Runtime pendiente |
| TPV-SES-03 | Dos operadores escriben a la vez | Lock serializa; no hay doble registro ni saldo perdido | Pendiente Runtime |
| TPV-SALE-01 | Venta dividida efectivo + tarjeta/Bizum/otros | Total aplicado = total de venta, desglose exacto | Verificado estático / Runtime pendiente |
| TPV-SALE-02 | Efectivo con cambio | Efectivo aplicado y cambio separados; cajón aumenta solo por efectivo neto | Parcial Runtime pendiente |
| TPV-SALE-03 | Pago no confirmado / sobrepago / retry | No se confirma venta incompleta; idempotencia sin duplicados | Parcial Runtime pendiente |
| TPV-SALE-04 | Documento nativo Wix | ID de pedido/recibo nativo correlacionado cuando la integración se autorice | Bloqueado |
| TPV-MOV-01 | Entrada/salida/retirada efectivo | Solo EFECTIVO; motivo, operador, sesión e idempotencia | Parcial |
| TPV-MOV-02 | Entrada/salida no monetaria | No altera efectivo esperado | Debe permanecer no permitido en movimiento físico |
| TPV-REF-01 | Devolución parcial mixta | No excede pagos originales; asignaciones por medio y efectivo físico correcto | Parcial Runtime pendiente |
| TPV-X-01 | Informe X repetido | No cierra ni bloquea la sesión; totales consistentes y actor auditado | Parcial |
| TPV-Z-01 | Cierre con operaciones pendientes | Rechaza sin cerrar | Verificado estático / Runtime pendiente |
| TPV-Z-02 | Cierre conciliado | Cuenta, diferencia, responsable y estado cerrado persistidos | Parcial Runtime pendiente |
| TPV-Z-03 | Replay Z igual / payload distinto | Replay estable / conflicto; nunca segundo cierre | Verificado estático / Runtime pendiente |
| TPV-Z-04 | Relación X → Z | Z referencia corte X y conjunto de operaciones incluido | GAP |
| TPV-AUD-01 | Auditoría de escrituras | Acción, actor, operador, sesión, timestamp, resultado y referencia | Parcial |
| TPV-AUD-02 | Lectura, exportación, impresión y denegación | Cada acción auditada con filtros/resultado/motivo | GAP |
| TPV-FISC-01 | Veri*Factu/QR | Solo QR devuelto por proceso fiscal autorizado; sin QR artificial | Bloqueado |
| TPV-ENV-01 | Sandbox y prueba negativa Published | Sandbox aislado; Published no puede ejecutar pagos ni writes fiscales | Pendiente Runtime |

## 3. Pruebas automatizadas añadidas

Suite nueva: `src/backend/tests/tpv.native-reconciliation.contract.test.mjs`.

- Comprueba estáticamente el origen Wix de la identidad y el aislamiento de actor.
- Comprueba que el controlador del candidato PR #538 importa WebMethods exportados y adapta `openingCash`, `lineItems/payments` a `lineas/pagos`.
- Comprueba los guards de roles y la sesión/lock.
- Comprueba medios de pago vigentes y cálculo de caja física.
- Comprueba condiciones X/Z, auditoría y política de no escritura nativa/fiscal.
- Declara como `test.todo` las pruebas que requieren Wix Preview/Published y datos/roles reales de prueba.

Estas pruebas son contractuales/estáticas; no demuestran la ejecución de Wix Runtime, el esquema CMS real ni la sincronización del Editor.

## 4. Bloqueos antes de aceptar TPV funcional

1. Resolver el contrato del operador: separar identidad Wix, profesional seleccionado y recurso Staff; comparar `profesionalId` con `operatorResourceId` en backend y rechazar mismatch.
2. Acordar y documentar la matriz de roles contra `ROL_WEBSITE`; no crear roles nuevos sin decisión de negocio.
3. Mantener el flujo sintético actual sin pagos, pedidos ni escrituras fiscales nativas hasta aprobación expresa y release gates.
4. Corregir la trazabilidad de `sessionId` en eventos de auditoría y auditar lecturas, exportaciones, impresión y denegaciones.
5. Definir si bonos/tarjetas regalo entran en alcance y su contrato end-to-end antes de añadirlos.
6. Enlazar X/Z mediante referencias y snapshot/corte reproducible.
7. Ejecutar las pruebas Runtime de la matriz en Sandbox real; prueba negativa Published sin efectos externos.
8. Verificar SHA instalado en Wix Editor, diff, CI, rollback y permisos antes de autorizar despliegue.

**Estado de aceptación:** **NO-GO**. El CI post-merge de PR #542 detectó aserciones contractuales obsoletas: primero esperaba cuatro métodos pese a que el enum centralizado contiene seis; después detectó una expectativa antigua sobre el default de paymentMethod en movimientos de caja. PR #543 corrige ambas clases de aserciones. Su HEAD eee6d75e5cf843a38823e7fa4c908783db175208 terminó SUCCESS: Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, contratos SDK y ESLint; Secret scanning SUCCESS. La corrección aún no está integrada en main. La suite estática no certifica Wix Runtime ni producción. No se han ejecutado escrituras CMS, pagos, devoluciones, facturación, emisión Veri*Factu, publicación ni despliegue.
