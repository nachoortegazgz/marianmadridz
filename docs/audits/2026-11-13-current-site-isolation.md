# Sitio actual — aislamiento y política de pruebas

**Fecha de actualización:** 2026-11-14  
**Site ID único:** 50b39f33-e753-4331-ab35-b2ed43dc97f7  
**Plataforma:** Wix Editor Classic + Velo  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.

## Autoridad y alcance

Este es el único sitio objeto de trabajo de Marian Madrid. No debe describirse como un segundo sitio de pruebas frente a otro sitio principal ni compararse con inventarios de sitios distintos. Los registros existentes se tratan como sintéticos salvo evidencia específica en contrario.

El sitio no se considera operativo para transacciones reales. No se deben ejecutar pagos, reembolsos, facturación, fichajes, comunicaciones ni automatizaciones externas sin autorización expresa, datos oficiales y pruebas específicas.

## Estado CMS verificado

- 23 colecciones: 15 NATIVE y 8 WIX_APP.
- 524 campos físicos en las colecciones NATIVE.
- MapaStaff: 18 campos; identidad de personal.
- DatosFiscales: 28 campos; maestro fiscal y de terceros.
- CajaActual: 39 campos; sequenceCounters OBJECT y operationDate DATE.
- ComplementosCatalogo: 18 campos.
- ControlOperativo: 42 campos.
- El inventario completo y los tipos están en DICCIONARIO_DATOS_CMS.md y docs/audits/2026-11-14-current-site-cms-normalization.md.

## Mutabilidad temporal

ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permite update/remove individual y masivo sobre colecciones propias incluidas en ISOLATED_SITE_MUTABLE_COLLECTIONS. Las operaciones masivas requieren IDs explícitos y un máximo de 1.000 registros. Las colecciones WIX_APP quedan excluidas.

La ventana no desactiva autenticación, autorización/RBAC, permisos, validaciones, secretos, allowlists de inserción ni gates de writers y efectos externos. La autorización temporal no habilita por sí misma operaciones comerciales.

## Límites de verificación

- No se ha realizado una mutación CMS en esta intervención.
- No se ha publicado código Wix.
- La correspondencia entre el código Velo del Editor y Git no está acreditada mediante exportación/hash.
- Las pruebas CI de la rama fix/current-site-cms-contract-alignment y la validación Wix Editor/E2E están pendientes.
- Los permisos efectivos de cada identidad deben verificarse mediante lectura actual de Wix y prueba con la identidad correspondiente; no se extrapolan desde capturas históricas.

## Documentos de referencia

- docs/audits/2026-11-14-current-site-cms-normalization.md
- docs/audits/2026-11-14-cajaactual-live-schema-audit.md
- ESTADO_ACTUAL_PROYECTO.md
- docs/PROJECT-STATUS.md
