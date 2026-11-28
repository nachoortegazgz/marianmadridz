> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`[CONTACTO PERSONAL REDACTADO]`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](./QA-ENVIRONMENT-SSOT.md).

---

> **Procedencia de evidencia:** este informe conserva observaciones y snapshots de una revisión anterior. La designación vigente identifica `188bed94-177c-4bc9-a9f0-35080d874f3e` como el único sitio QA, pero no convierte automáticamente los datos CMS, settings o recuentos históricos en evidencia del estado actual de ese sitio. Repetir lecturas de solo lectura en el Site ID vigente antes de cualquier mutación. No existe otro sitio QA ni un QA externo designado.

---

# Registro histórico de auditoría de colecciones personalizadas — superado

**Actualización:** 2026-11-14

El contenido anterior de este archivo describía un snapshot de CMS y una clasificación de sitio que ya no corresponden al estado vigente. Se conserva este registro únicamente para trazabilidad; sus IDs, recuentos, revisiones y valores no deben utilizarse para decisiones actuales.

## Alcance vigente

- Sitio al que se refiere este corte histórico: referencia anterior de entorno, supersedida. No constituye baseline del sitio QA vigente `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Naturaleza: banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.
- Plataforma: Wix Editor Classic + Velo.
- Inventario actual: 23 colecciones (15 NATIVE, 8 WIX_APP), 524 campos físicos NATIVE.
- Esquema vigente: DICCIONARIO_DATOS_CMS.md y docs/audits/2026-11-14-current-site-cms-normalization.md.
- La auditoría vigente de CajaActual está en docs/audits/2026-11-14-cajaactual-live-schema-audit.md.

## Regla de sustitución

No se deben reutilizar los hallazgos históricos de este documento como si fueran lecturas actuales. En particular, no se deben extrapolar datos de otro Site ID ni asumir que las colecciones, campos o registros descritos aquí siguen presentes. Cualquier decisión de esquema requiere lectura actual de Wix Data Collections API sobre el sitio único indicado.

No se ejecutó ninguna mutación CMS al sustituir este documento.
