# Wix Preview / Runtime — plan de aceptación TPV

**Estado:** NO EJECUTADO según la última evidencia fechada. Este plan separa pruebas de lectura, pruebas de aplicación aisladas y aceptación de operaciones productivas. No se exige configuración fiscal productiva para probar lógica sin efectos externos.

## Objetivo

Validar bridge, permisos, WebMethods, persistencia, idempotencia, concurrencia y recuperación en niveles proporcionales al riesgo, sin publicar ni producir efectos externos.

## Niveles de prueba

### A. Lectura y diagnóstico

Puede ejecutarse sin fixtures ni escrituras: fingerprint, handshake, catálogo de diagnóstico, permisos efectivos y lectura de estado. No requiere sesión de caja sintética ni configuración fiscal productiva.

### B. Pruebas de dominio y contrato

Se ejecutan en CI con fixtures explícitos y adaptadores simulados. Deben probar tanto los rechazos fail-closed esperados como los recorridos válidos del dominio. No requieren identidad Wix, CMS real, serie fiscal productiva, pagos, SharePoint ni configuración de activación real.

### C. Integración Wix aislada

Precondiciones específicas:
1. Preview del sitio correcto y fingerprint/build SHA leído.
2. Identidad de prueba y permisos efectivos verificados para los WebMethods invocados.
3. Tenant/espacio de prueba o fixture aislado creado por el writer canónico, sin tocar `CajaActual` singleton ni ledgers históricos compartidos.
4. Pagos, AEAT, terminales, notificaciones y otros efectos externos interceptados por adaptadores simulados.
5. IDs de correlación y limpieza/reversión limitados a datos de test no append-only. Los registros append-only de test se conservan y se rectifican mediante nuevos eventos.

No es precondición para esta categoría disponer de configuración fiscal productiva, credenciales de cobro, serie real o datos de clientes reales.

### D. Aceptación productiva

Requiere configuración legal/fiscal validada, permisos, proveedores reales autorizados, pruebas operativas y aprobación correspondiente. No se ejecuta como parte de QA sintético.

## Secuencia recomendada

1. **Bridge read-only:** handshake `MM_READY → MM_CONTEXT`, diagnóstico y validación de protocolo.
2. **Autorización:** roles permitidos y denegados en WebMethods.
3. **Preflight:** comprobar resultado con configuración ausente/incompleta y con fixture válido.
4. **Gate real:** verificar que `registrarVenta()` rechaza la operación no preparada sin persistir una intención.
5. **Dominio simulado:** ejecutar el mismo flujo con fixture fiscal/catalogo y puertos simulados; comprobar intención y resultados en repositorio de test, sin pago ni ledger productivo.
6. **Idempotencia:** replay idéntico no duplica; payload conflictivo se rechaza.
7. **Concurrencia:** dos operaciones con la misma clave/recurso; comprobar adquisición única y respuesta determinista.
8. **Persistencia/recuperación:** read-back del repositorio aislado, lock, auditoría y proyección; simular timeout/reintento.
9. **Cierre/arqueo:** probar cálculos y contrato con fixture/dobles en CI. Cualquier persistencia append-only en Wix requiere fixture aislado y conservar el registro; nunca usar la caja o históricos existentes.

## Evidencia

Por prueba guardar commit/fingerprint, entorno, identidad/rol cuando aplique, método, payload anonimizado, IDs de correlación, resultado, read-back y logs. No registrar secretos, datos de tarjeta ni datos personales innecesarios.

## Criterios PASS

- Fingerprint coincidente para pruebas Wix.
- Bridge y autorización backend correctos.
- Gates reales rechazan operaciones no preparadas.
- El mismo dominio funciona con fixtures y adaptadores simulados.
- Persistencia lógica idempotente y concurrencia controlada en el repositorio probado.
- Cero efectos externos reales.
- Ninguna mutación de caja singleton ni ledger histórico compartido.

Un smoke HTTP, test estático, mock o CI offline no acredita Runtime E2E; sí acredita el nivel concreto que realmente ejecuta.
