# TPV — auditoría del contrato neutral de origen y entorno

Fecha: 2026-11-23  
Base auditada: main — 65f53ea7ee3f02664e4345931a6fab3d418d3555  
Rama: audit/tpv-neutral-source-contract-2026-11-23  
Tipo de cambio: documentación de auditoría; no modifica código ni CMS.

## 1. Resultado ejecutivo

La neutralización es PARCIAL. El repositorio ya dispone de TPV_COLLECTIONS, TPV_RUNTIME_POLICY, claves CONTROL_TYPE.TPV_SESSION_LOCK y CONTROL_TYPE.TPV_REFUND_LOCK, metadatos sourceType/siteId/ledgerVersion/sessionId, IDs de operación TPV-* y errores de sesión neutrales. Sin embargo, persisten dependencias de implementación y compatibilidad que impiden considerar completadas las acciones 1–18.

No debe hacerse un reemplazo global de SANDBOX por TPV. Algunas cadenas son valores persistidos, nombres de colecciones CMS, marcadores históricos o controles de aislamiento. Una sustitución textual puede hacer invisibles eventos, romper la idempotencia o permitir que un registro nativo pase por sintético.

## 2. Hallazgos reproducibles

| Área | Evidencia en main | Estado / riesgo |
|---|---|---|
| Constantes lógicas | src/backend/internalConfig.js: TPV_COLLECTIONS usa valores SANDBOX_LOGICAL_* y conserva alias TPV_SANDBOX_*. | Parcial. Los valores forman parte de payloadFiscal.logicalCollection; requieren lectura dual si se renombran. |
| Política | TPV_RUNTIME_POLICY deniega pagos reales y escrituras nativas/fiscales, pero conserva ENVIRONMENT, ACTOR_ID y SANDBOX_RUN_ID. | Parcial. Política y contexto de ejecución siguen mezclados. |
| Locks | CONTROL_TYPE.TPV_SESSION_LOCK y TPV_REFUND_LOCK son claves neutrales, pero sus valores CMS siguen siendo TPV_SANDBOX_SESSION_LOCK y TPV_SANDBOX_REFUND_LOCK. | Compatibilidad persistida. No cambiar valores sin lectura dual de ControlOperativo. |
| CajaActual | tpvUtils.js::assertSandboxCajaWritable acepta metadatos explícitos, pero conserva bootstrap y lectura heredada dependientes de SANDBOX_RUN_ID y snapshotSource. | Parcial. La ruta explícita nueva no necesita run ID; bootstrap legacy sí. |
| Identificadores | makeSandboxTransactionId incluye SANDBOX_RUN_ID; makeLegacySandboxTransactionId conserva un formato anterior. | Pendiente. Cambiarlo sin buscar todos los formatos anteriores puede duplicar eventos en retries. |
| Ledger | tpvSandboxRepository.js escribe recordSource=TPV_SANDBOX_SYNTHETIC, schemaVersion=TPV_SANDBOX_SYNTHETIC_V1, sandboxRunId, trazas con run ID y serie NO-FISCAL-*. | Parcial. Los marcadores antiguos deben seguir siendo legibles; nuevas escrituras necesitan contrato neutral y versionado. |
| Política de escritura | dataAccessPolicy.js::_isSyntheticTpvRecord valida metadatos explícitos, pero también exige trazas ligadas al run ID. | Pendiente. La validación debe ser independiente del nombre del entorno. |
| Hooks CMS | data.js reconoce registros sintéticos históricos; validation.js sigue validando identidades mediante entorno/run ID. | Pendiente de compatibilidad dual y pruebas negativas. |
| Identidades | tpvSandboxIdentities.js filtra environment=SANDBOX, testRunId y syntheticOnly. tpvVentas.web.js distingue actorId, operatorId y profesionalId en el evento de venta. | Parcial. El contexto de venta está separado; el repositorio aún usa fallback TPV_SYSTEM en proyecciones de caja/cierre. |
| Idempotencia | registrarVenta recibe idempotencyKey; el repositorio calcula fingerprint, consulta antes de insertar y reconcilia el ganador concurrente. | Parcial. Falta acreditar clave interna estable neutral y retry concurrente en Wix Runtime. |
| Errores | TPV_SESSION_NOT_OPEN y TPV_SESSION_MISMATCH ya usan nomenclatura neutral. | Parcial. Revisar contratos visibles y separar diagnóstico interno. |
| Estados | Se usan CONFIRMADA_SINTETICA, SIMULATED y estados de lock. | Pendiente. Definir transiciones y evidencia antes de introducir nuevos estados. |
| Módulos antiguos | tpv.web-modules.contract.test.mjs comprueba ausencia de varios módulos legacy y cableado al árbol backend/tpv/. | Parcialmente cubierto. Ampliar búsqueda a src/backend/tpv*.web.js antes de eliminar. |
| UI | public/tpvPageController.js y #htmlTPV ya evitan flags de entorno en el widget. | Pendiente de revisar etiquetas de estado y que capacidades reales gobiernen botones. |
| Runtime | No hay evidencia de Preview E2E ni pruebas negativas Published en esta auditoría. | No validado. No desplegar ni escribir CMS. |

## 3. Decisiones de arquitectura

1. Entorno no es origen. sourceType define el origen del registro (SYNTHETIC o NATIVE); el entorno es contexto diagnóstico y no sustituye autorización ni aislamiento.
2. Aislamiento obligatorio. Las escrituras sintéticas solo pueden operar sobre registros sintéticos del sitio y sesión propietarios. Las escrituras nativas quedan deshabilitadas hasta disponer de integración autorizada y probada.
3. Lectura dual, escritura canónica. Los registros históricos TPV_SANDBOX_SYNTHETIC, TPV_SANDBOX_SYNTHETIC_V1, IDs antiguos y locks históricos se conservan como formatos de lectura. Las nuevas escrituras usarán contrato neutral, sin sobrescribir registros históricos.
4. Integridad verificable. CajaActual debe validar propietario siteId, origen, versión, sesión y huella/hash del ledger. El run ID podrá permanecer para reconocer filas históricas, pero no será la única prueba de propiedad ni el guard de nuevas cajas.
5. Locks conservados. Deben quedar acotados por sitio, sesión/operación y recurso. Los valores CMS antiguos no se renombrarán sin lector compatible y estrategia de retirada.
6. Identidades separadas. actorId es el miembro autenticado; operatorId es el operador autorizado; profesionalId es el profesional de la línea/servicio. TPV_SYSTEM no sustituye a una persona.
7. Persistencia no equivale a conciliación. Guardar en CMS no demuestra captura en Wix Payments, cambio en Stores, mutación de Bookings, uso de Gift Cards ni emisión de Wix Invoices.

## 4. Orden de implementación seguro

### Fase A — contratos y lectura dual
- Inventariar referencias en src/, tests, workflows y documentación, clasificando entorno, origen, formato histórico, colección física, ID, lock, error o comentario.
- Definir contrato canónico versionado para caja y ledger: sourceType, schemaVersion/ledgerVersion, siteId, sessionId, eventHash/huella, recordSource y flags de side-effects.
- Mantener lectura legacy explícita y escritura neutral. El frontend nunca será autoridad para sourceType.
- Retirar SANDBOX_RUN_ID del guard de nuevas cajas; conservarlo solo para reconocer filas e identidades históricas hasta completar transición.
- Cambiar IDs solo después de añadir búsqueda fuerte por ID canónico y todos los IDs históricos.

### Fase B — locks, actores e idempotencia
- Mantener CAS/versionado y expiración de locks. Acotar scope y fingerprint por siteId, sessionId y operación.
- Auditar consumidores de TPV_SYSTEM; propagar contexto autenticado y separar actor, operador y profesional.
- Derivar claves internas deterministas por operación hija (venta, línea, pago, movimiento, devolución, X/Z).
- Misma clave y mismo fingerprint: devolver resultado previo. Misma clave y fingerprint distinto: conflicto. Reintento concurrente: un único evento y proyección idempotente.

### Fase C — conciliación y contratos nativos
- Definir estados PENDING, SYNTHETIC_CONFIRMED, NATIVE_CONFIRMED, RECONCILED y FAILED con transiciones y evidencia exigible.
- Verificar API/SDK y permisos antes de implementar Wix Payments, Wix Stores, Wix Bookings, Gift Cards y Wix Invoices V1.
- No declarar NATIVE_CONFIRMED ni RECONCILED por una escritura CMS. Exigir evidencia del proveedor y conciliación de IDs/importes.

### Fase D — regresión y aceptación
- Unitarias: origen, hash/versionado, IDs canónicos y legacy, conflictos de fingerprint, estados y errores públicos.
- Integración: cobro sintético, devolución parcial, entrada/salida de caja, Control X, cierre Z, replay idempotente y dos operadores simultáneos.
- Negativas: synthetic→native, native→synthetic, sitio/sesión distintos, hash alterado, versión desconocida, actor no autorizado y llamada desde Published.
- Preview: solo CMS Sandbox real y datos sintéticos. Comparar Online antes/después mediante lectura; cero escrituras, pagos, reembolsos o mutaciones nativas.
- No publicar hasta superar CI, revisión de diff, E2E, aislamiento, reversión y aprobación de release.

## 5. Criterios de aceptación

- Ningún registro sintético actualiza una caja, movimiento o identidad nativa.
- Ningún registro nativo se clasifica como sintético por recordSource, prefijo de ID, entorno o valor enviado por cliente.
- Nuevas escrituras no dependen de SANDBOX_RUN_ID para demostrar propiedad de CajaActual.
- La lectura legacy mantiene visibles registros anteriores sin reescribirlos.
- Locks mantienen exclusión mutua y CAS por sitio/sesión/operación.
- Actor autenticado, operador y profesional quedan diferenciados.
- Misma clave y payload no duplica; payload distinto genera conflicto.
- Persistencia CMS, confirmación nativa y conciliación son estados distintos.
- CI y pruebas Runtime se reportan por separado.

## 6. Límites

- Verificado: código de los archivos indicados en el commit base y contratos offline encontrados por búsqueda.
- Declarado documentalmente: aislamiento Sandbox, metadatos explícitos y side-effects deshabilitados.
- Inferido: valores SANDBOX_LOGICAL_* y TPV_SANDBOX_* forman parte de contratos históricos internos; confirmar con exportación CMS y consumidores antes de cambiarlos.
- Pendiente: ejecución de Vitest/Node tests, CI del HEAD, Wix Preview E2E, prueba negativa Published, lectura comparativa CMS Sandbox/Online y revisión de integraciones nativas.
- No se ejecutaron escrituras CMS, pagos, reembolsos, cambios de configuración Wix ni despliegues.
