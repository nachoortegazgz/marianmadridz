# Directriz del propietario — estado de desarrollo, pruebas y objetivos finales

**Fecha de registro:** 2026-11-20  
**Autoridad:** instrucción expresa y vigente del propietario.  
**Ámbito:** sitio completo, código, CMS, integraciones, automatizaciones, documentación y pruebas del ecosistema Marian Madrid.

> **AVISO IMPORTANTE — 19-11-2026:** el sitio web está en fase de desarrollo y pruebas. Se creó como base de pruebas y no tiene ninguna actividad real. Todos sus registros son sintéticos y serán eliminados cuando se despliegue para uso real. El propietario autoriza pruebas completas con registros para comprobar la funcionalidad de procesos y depurar errores. Los registros generados en estas pruebas se usarán solo como comprobación de funcionalidad y se eliminarán antes del despliegue real del sitio desarrollado. Se realizarán simulacros completos con registros como ensayo previo al uso real.

## Fuente única de objetivos y precedencia

La única SSOT de requisitos de negocio y aceptación funcional es la petición de Marian Madrid para su negocio, junto con las instrucciones vigentes del propietario. La documentación del repositorio, los informes, decisiones históricas, código, configuraciones y datos CMS son artefactos derivados, editables y subordinados: deben actualizarse cuando contradigan esta directriz. Las fuentes oficiales vigentes de Wix y de cada integración son la autoridad para contratos, APIs, permisos, límites y comportamiento técnico; la normativa legal vigente aplicable en España es obligatoria y no puede ser dispensada por una decisión técnica o de pruebas.

Orden de decisión:
1. Requisitos, objetivos y criterios de aceptación expresos de Marian Madrid y del propietario.
2. Normativa legal vigente aplicable en España.
3. Documentación oficial vigente de Wix y de las integraciones para implementar técnicamente los requisitos.
4. Esta directriz como registro de gobierno vigente.
5. Dossiers, ADR, informes, decision logs, inventarios, código y snapshots históricos, que se mantienen solo como evidencia y deben alinearse.

Cuando exista contradicción, no se perpetuará como bloqueo una regla histórica o un supuesto documental. Se identificará el conflicto y se corregirá el artefacto derivado. No se inventarán requisitos para rellenar lagunas.

## Política de datos y simulacros

- El propietario declara que el sitio no ha tenido actividad real y que todos sus registros actuales y futuros de pruebas son sintéticos.
- Se autorizan simulacros funcionales completos y persistentes, con registros sintéticos, para verificar flujos end-to-end, concurrencia, idempotencia, errores, recuperación, cierres, informes y depuración.
- Los datos de prueba no representan operaciones económicas, laborales, fiscales ni comerciales reales y no deben enviarse a terceros ni producir efectos externos.
- Antes del primer despliegue para uso real se ejecutará un reset integral planificado de los datos sintéticos, con inventario, backup/evidencia, alcance, comprobación de entorno, ejecución controlada y verificación posterior. No se eliminarán evidencias o artefactos de auditoría necesarios para demostrar las pruebas, salvo que su retención y eliminación se hayan resuelto conforme a la normativa aplicable.
- La autorización de pruebas incluye crear, actualizar y eliminar registros sintéticos cuando sea necesario para simular y depurar. No implica que una API, hook, permiso CMS o writer ya esté técnicamente habilitado: cada operación debe implementarse en el backend, con autenticación, autorización, validación, trazabilidad e idempotencia adecuadas y probarse antes de declararla operativa.
- Los datos y recursos de Wix Apps se manipulan exclusivamente mediante APIs y contratos oficiales soportados. Sandbox/Preview se utilizará cuando esté disponible y verificado; si el test debe ejecutarse en LIVE del sitio de desarrollo, se comprobará previamente que los flujos no puedan alcanzar usuarios, pagos, comunicaciones o terceros reales. No se presumirá aislamiento por el nombre del entorno ni por una condición controlable desde frontend.
- Las protecciones de integridad requeridas por ley, los controles de seguridad, la separación de datos, la autorización backend y la trazabilidad siguen siendo obligatorios. La condición sintética permite limpiar los datos de ensayo antes de producción; no convierte una operación legalmente regulada en ficticia si se conecta a un servicio real ni autoriza emitir/transmitir documentos fiscales reales durante QA.
- El reset preproducción debe retirar exclusivamente datos sintéticos identificados y aprobados. La limpieza no se realizará mediante borrado indiscriminado de colecciones, ni afectará secretos, configuración, identidades nativas, datos de Wix Apps o evidencia retenida por obligación legal/contractual.

## Objetivos finales — lista breve y prioritaria

1. Cumplir íntegramente las funcionalidades solicitadas por Marian Madrid y sus criterios de aceptación.
2. Usar Wix JavaScript SDK v2 o la versión vigente recomendada oficialmente; eliminar APIs deprecated y contratos no soportados.
3. Mantener el mínimo código necesario, arquitectura coherente y ausencia demostrada de código muerto, duplicidades y complejidad injustificada.
4. Cumplir documentación oficial de Wix e integraciones, con validación de contratos, permisos, límites, eventos y comportamiento runtime.
5. Cumplir normativa legal vigente en España, especialmente fiscal, contable, laboral, privacidad, consumo y conservación documental cuando resulte aplicable.
6. Garantizar seguridad, autorización server-side, protección de secretos, integridad, idempotencia, concurrencia, observabilidad y recuperación.
7. Completar pruebas unitarias, integración, regresión y simulacros E2E con registros sintéticos; documentar resultados reales y limitaciones.
8. Preparar un reset preproducción verificable y una configuración final apta para actividad real, sin datos sintéticos residuales ni efectos de prueba activos.

## Método de trabajo

- Priorizar siempre la lista breve de objetivos finales y la reducción de acciones/comprobaciones que no aporten evidencia.
- Antes de modificar código: identificar módulo, consumidores, contratos, dependencias, documentación oficial y pruebas de aceptación.
- Implementar el cambio mínimo que cumpla el objetivo; no reconstruir ni refactorizar módulos funcionales sin evidencia.
- Centralizar constantes canónicas en `internalConfig.js`, validaciones en `validation.js`, lógica y autorización en backend/WebMethods; frontend solo presenta y orquesta.
- No declarar pruebas, sincronizaciones, despliegues ni validaciones que no se hayan ejecutado.
- Cada cambio debe tener diff revisado, CI pertinente, estrategia de reversión y documentación actualizada.
- Mantener el despliegue real bloqueado mientras existan incumplimientos legales, fallos críticos, efectos externos no controlados o ausencia de reset/verificación preproducción.

## Estado y límites

Esta directriz autoriza el trabajo y los simulacros, pero no acredita por sí sola que una funcionalidad esté implementada, que Wix Sandbox esté habilitado, que una automatización esté neutralizada, que el runtime corresponda al commit de GitHub ni que el sitio esté listo para producción. Esas condiciones requieren evidencia específica y actualizada.
