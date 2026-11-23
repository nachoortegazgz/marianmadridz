> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](../qa/QA-ENVIRONMENT-SSOT.md).

---

# Verificación de la ruta del calendario en Wix — 2026-11-05

## Resultado

La ruta publicada de la página Velo identificada como **Calendario de reservas 2** es:

`/booking-calendar`

La ruta anterior `/booking-calendar/calendario-2` no coincide con la ruta base publicada que devuelve Wix.

## Evidencia de solo lectura

Sitio: `188bed94-177c-4bc9-a9f0-35080d874f3e`

1. Wix Site Context — `ListDynamicPages`:
   - `published: true`
   - `id: q39h6`
   - `title: Calendario de reservas 2`
   - `path: /booking-calendar`
   - `hasItemPages: true`
2. El ID `q39h6` coincide con el sufijo de la página Velo `src/pages/Calendario de reservas 2.q39h6.js`.
3. Wix Site Context — `ListDynamicItemPages`, con `prefix: /booking-calendar` y `pageId: q39h6`:
   - `published: true`
   - `items: []`
4. La página de servicio ya construye la navegación con `serviceId` y `slug` como parámetros de consulta, y la página calendario los lee desde `location.query()`.

## Cambio aplicado en la rama QA

`PROTOCOL_URLS.CALENDARIO_2` pasa a `/booking-calendar`. Los parámetros `serviceId`, `slug`, `referral` y `addOnIds` se conservan en la query string.

## Límite de la verificación

Esta comprobación confirma la ruta base registrada y publicada en Wix. No prueba todavía la ejecución del HTML Component ni el flujo de disponibilidad en navegador. La rama GitHub tampoco equivale a código publicado en Wix. Antes de cerrar funcionalmente la incidencia hay que comprobar Preview/QA y verificar que el contenido de los HTML Components en Wix coincide con los snapshots versionados.
