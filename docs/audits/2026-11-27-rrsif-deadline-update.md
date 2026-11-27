# Actualización normativa RRSIF — 2026-11-27

## Hallazgo

La documentación de cumplimiento del proyecto citaba como calendario vigente del RD 1007/2023 las fechas de 1 de enero de 2027 y 1 de julio de 2027 introducidas por el RDL 15/2025. Esa referencia quedó supersedida por el **Real Decreto-ley 43/2026, de 24 de noviembre**, publicado el 25-11-2026 y en vigor desde el 26-11-2026.

La disposición final primera del RDL 43/2026 vuelve a modificar la disposición final cuarta del RD 1007/2023. Para los obligados tributarios del artículo 3.1, el plazo de adaptación se vincula ahora al plazo de la letra b) del apartado 1 de la disposición final cuarta del RD 238/2026: 24 meses desde la entrada en vigor de la Orden HAC/1028/2026.

La Orden HAC/1028/2026 entró en vigor el 06-10-2026. Por tanto, el cómputo de 24 meses conduce al **06-10-2028** para la adaptación RRSIF de los obligados del artículo 3.1.

## Distinción imprescindible

- **RRSIF / RD 1007/2023:** para los obligados del artículo 3.1, la DF4 modificada por RDL 43/2026 remite al plazo de 24 meses de la letra b) de la DF4.1 del RD 238/2026 (06-10-2028).
- **Factura electrónica B2B / RD 238/2026:** conserva su propio calendario: 12 meses para empresas con volumen de operaciones superior a 8 millones de euros y 24 meses para el resto, contados desde la entrada en vigor de la Orden HAC/1028/2026.
- El plazo de nueve meses del artículo 3.2 del RD 1007/2023 se refiere a obligaciones de productores/comercializadores de sistemas informáticos y no debe confundirse con el plazo de adaptación del obligado tributario que utiliza el sistema.

## Impacto en Marian Madrid

1. Retirar de la planificación RRSIF las fechas 01-01-2027 y 01-07-2027 que derivaban del RDL 15/2025.
2. Registrar 06-10-2028 como hito legal calculado para RRSIF del artículo 3.1, sujeto a revisión de asesoría fiscal ante cualquier modificación posterior.
3. No cambiar el estado técnico: el writer fiscal sigue deshabilitado, falta el singleton de configuración fiscal legal y no existe aceptación runtime ni conformidad/certificación acreditada.
4. Mantener el requisito de precio final completo al consumidor y los requisitos de integridad, trazabilidad, conservación y encadenamiento que resulten aplicables. El aplazamiento del calendario no los elimina.
5. No deducir que la factura electrónica B2B y el SIF son una sola obligación ni reutilizar el plazo de una para la otra.

## Fuentes oficiales

- [RDL 43/2026, de 24 de noviembre (BOE-A-2026-24701)](https://www.boe.es/eli/es/rdl/2026/11/24/43) — publicación 25-11-2026; entrada en vigor 26-11-2026.
- [RD 238/2026, de 25 de marzo (BOE-A-2026-7295)](https://www.boe.es/eli/es/rd/2026/03/25/238) — DF4.1.a y b: 12 y 24 meses para factura electrónica B2B.
- [Orden HAC/1028/2026 (BOE-A-2026-20587)](https://www.boe.es/eli/es/o/2026/10/02/hac1028/con) — entrada en vigor 06-10-2026 e inicio del cómputo.
- [RD 1007/2023, texto consolidado](https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840) — DF4 modificada por RDL 43/2026.

**Estado:** corrección documental normativa; no modifica código, CMS, writers, configuración, pagos ni publicación. La aplicación concreta al régimen fiscal del negocio debe confirmarse con asesoría fiscal.
