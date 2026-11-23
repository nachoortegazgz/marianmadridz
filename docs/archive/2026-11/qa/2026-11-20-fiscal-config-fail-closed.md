# QA — Configuración canónica SIF fail-closed

**Fecha:** 20/11/2026 (Europe/Madrid)  
**Estado:** corrección integrada en código y CI; configuración CMS y validación legal pendientes.  
**Issues:** #209, #415  
**Implementación:** PR #447  
**Merge commit:** `a6fe89b862f5fe3983d5f7b19e0f58b0c68e9f24`

## Objetivo

Evitar que el payload fiscal AEAT se complete con identificadores, nombre comercial, versión, número de instalación o indicadores locales no acreditados cuando falte el singleton fiscal.

## Cambio integrado

En `src/backend/eventLog.js`:

1. Eliminado `COMPUTER_SYSTEM_FALLBACK`.
2. Lectura strong de `MapaStaff` filtrada por `recordType=CONFIG_SISTEMA`, con límite de dos elementos para detectar duplicidad.
3. Se exige exactamente un registro y el ID singleton `CONFIG_SISTEMA_FISCAL`.
4. Se validan los campos explícitos:
   - `sistemaInformaticoNombre`
   - `idSistemaInformatico`
   - `verifactuVersion`
   - `numeroInstalacion`
   - `tipoUsoPosibleSoloVerifactu`
   - `tipoUsoPosibleMultiOT`
   - `indicadorMultiplesOT`
   - `taxId`
   - `legalName`
   - `fechaInicioVerifactu`
5. Flags se normalizan a `S/N`; cualquier valor no interpretable falla.
6. La fecha debe ser una fecha real con formato `YYYY-MM-DD`.
7. Fallos de lectura, ausencia, duplicidad o configuración incompleta terminan con error. No se cachean configuraciones incompletas.

## Pruebas

- Configuración ausente → `FISCAL_CONFIG_MISSING`.
- ID de singleton no canónico → `FISCAL_CONFIG_MISSING`.
- Configuración parcial → `FISCAL_CONFIG_INCOMPLETE`.
- Configuración completa sintética → acepta y devuelve snapshot congelado.
- Los tests de integración de pago/reembolso utilizan un fixture SIF sintético completo; no representan ni crean una configuración CMS real.

CI del HEAD integrado:
- Layer 1: 331/331.
- Layer 2: 261/261.
- Suite completa: 679/679.
- npm audit: 0 vulnerabilidades.
- SDK Cart V2, Order Transactions, TPV Catalog, ESLint y Gitleaks: SUCCESS.

## Bloqueo estructural pendiente

La configuración física actual de `MapaStaff` no contiene todos los campos anteriores y `data.js` prohíbe expresamente varios de ellos en `CONFIG_SISTEMA`. No existe actualmente un registro CONFIG_SISTEMA físico acreditado.

No se debe crear el registro ni introducir valores provisionales hasta:

1. Aprobar el modelo canónico del SIF y su productor.
2. Confirmar con titular/asesoría el nombre oficial, identificador de sistema, versión declarada, número de instalación, indicadores y fecha de inicio.
3. Acordar si esos campos se incorporan a `MapaStaff` o a una colección de configuración fiscal separada, sin duplicar identidad STAFF/TERCERO/GESTORIA.
4. Actualizar el esquema físico CMS y las validaciones/hooks de backend en una intervención específica.
5. Probar lectura, escritura elevada, unicidad del singleton y permisos en Wix QA.

## Seguridad y alcance

- No se han realizado escrituras CMS.
- No se han modificado secretos, ledgers, caja ni compensaciones.
- No se han recalculado hashes históricos.
- `LEDGER_WRITES_ENABLED=false` y `ACCOUNTING_LEDGER_WRITES_ENABLED=false` permanecen sin cambios.
- No se ha publicado ni activado remisión AEAT.
- CI offline no acredita la conformidad VERI*FACTU ni la ejecución Wix Runtime.

## Criterio de cierre

Solo cerrar #209/#415 cuando el esquema aprobado y físico permita almacenar la configuración legal verificada, se supere E2E Wix Sandbox, se validen los vectores oficiales AEAT y exista autorización legal/técnica para el SIF. Esta corrección elimina datos ficticios; no equivale a certificar ni activar el sistema.
