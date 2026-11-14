# Reconciliación de baseline y recuperación de validadores — 2026-11-14

## Autoridad y alcance

Este documento fija el estado verificado de Git y del CMS en este corte. No sustituye decisiones del propietario ni certifica el runtime publicado. La documentación oficial de Wix define los contratos técnicos. Los documentos históricos se conservan como evidencia, pero no prevalecen sobre este corte.

## Estado verificado

- Repositorio: `nachoortegazgz/marianmadridz`.
- `main` en el inicio de esta intervención: `79b6238fe4c23206bb8e81327191ab48425e3a0d`, merge de PR #351.
- PR #351 está integrada en `main`. Su cambio de `src/backend/validation.js` redujo el módulo de 17.632 a 7.100 caracteres y dejó fuera validadores que seguían siendo importados por `src/backend/data.js`.
- PR #352: reparación en la rama `fix/control-operativo-canonical-validation`. CI completo PASS en `c7388cb122368906b1cee20cae0f6d127900553b` (run #1048): Layer 1, Layer 2, regresión offline completa, SDK contracts y ESLint; Gitleaks PASS (run #472). No publicada en Wix.
- No se dispone de un identificador Wix que vincule el runtime publicado con el SHA actual de Git.

## Hallazgo P1 — regresión de validadores

La versión previa a PR #351, recuperada del commit `b68e4e048ce5fc1c022fc6ffc2643d5983972107`, exportaba:

- `assertCitasF2`
- `assertMapaStaffRecord`
- `assertCanonicalControlFields`
- `assertControlOperativo`
- `assertRegistrosHorariosStaff`
- `assertValidEnum`
- `isValidNifOrEuVat`
- `isExplicitSimulationLedgerRecord`

La versión integrada por PR #351 conservó solo `assertValidEnum`, `isValidNifOrEuVat`, `assertDatosFiscales` y `assertMapaStaffRecord`. Esto dejó contratos consumidos por `data.js` sin export y sustituyó la validación fiscal robusta anterior por una comprobación estructural más permisiva para VAT-UE.

## Reparación propuesta en PR #352

- Recuperar la implementación completa de validadores del commit previo conocido y probado.
- Conservar el helper fiscal nuevo, renombrado como `assertMapaStaffFiscalIdentity`, para no referenciar una colección `DatosFiscales` inexistente.
- Mantener el uso del validador fiscal compartido en `data.js`.
- Actualizar la prueba de contrato para usar el nombre canónico.
- No alterar enums, esquema CMS, permisos, writers, datos ni política temporal de QA.

## CMS live — corte 2026-11-14

Fuente: `DICCIONARIO_DATOS_CMS.md`, generado desde Wix Data Collections API en el corte indicado.

- 41 colecciones: 12 `NATIVE` y 29 `WIX_APP`.
- 980 definiciones físicas de campo.
- `MapaStaff`: revisión 105, 56 campos físicos.
- `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario`: no aparecen en el inventario live y los GET individuales devolvieron 404 / `WDE0025`.
- No recrear esas colecciones por referencias históricas o allowlists de QA.

## Política de QA y seguridad

- `QA_RECORD_MUTATIONS_ENABLED=true` permanece activa por autorización expresa del propietario.
- Esta bandera permite update/remove en CMS propias durante QA; no habilita insert, writers fiscales/contables/laborales, pagos, reembolsos ni efectos externos.
- La bandera es un bloqueo de producción. No se modifica en esta intervención.
- No se ha cambiado CMS live, Wix Editor, permisos, automatizaciones, datos ni configuración de aplicaciones.
- No se ha publicado ni desplegado código.

## Inventario e integraciones

- Wix Stores Catalog V3 es la autoridad operativa del catálogo/stock comercial.
- La capa de inventario personalizado está retirada por decisión documentada en el ADR de inventario nativo. No se reactivan writers ni exports de inventario personalizados.
- Capa 3 (SharePoint / Power Automate) continúa como diseño documental; su operación end-to-end no está certificada.
- El documento `NECESIDADES WEB MARIAN.txt` aportado en esta conversación no está versionado en Git; su matriz de requisitos debe reconciliarse antes de tratar sus estados declarados como aceptación. Las directrices originales tampoco estaban versionadas; se ha creado `docs/engineering/DEVELOPMENT-STANDARDS.md` como versión consolidada y vigente basada en ese estándar.

## Criterios de cierre de esta tanda

1. Los exports importados por todos los consumidores existen y mantienen sus contratos.
2. La suite `npm test`, `npm run test:layer1`, `npm run test:layer2` y `npm run lint` pasan en CI sobre el mismo SHA.
3. La inspección de diff no detecta cambios en reglas de negocio ajenas al hallazgo.
4. Se documenta el estado de CI con enlaces y SHA reales.
5. No se publica en Wix hasta resolver el bloqueo de QA y obtener autorización expresa.
