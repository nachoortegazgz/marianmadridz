# Capa 0 — secretos, importes y configuración canónica — 28-11-2026

Estado: cambios en rama; CI pendiente. Sin cambios en CMS ni datos productivos.

## Secretos Wix

La documentación oficial de Get Secret Value define una respuesta con value:string, pero no documenta un catálogo de errores que permita distinguir de forma fiable secreto inexistente y proveedor no disponible.

Implementación:
- Nombre vacío/no string: SECRET_NAME_REQUIRED.
- Error de SDK/proveedor: SECRET_PROVIDER_ERROR, conservando cause y providerCode cuando existe.
- Respuesta sin value string: SECRET_RESPONSE_INVALID.
- Value vacío/solo espacios: SECRET_VALUE_EMPTY.
- El valor se devuelve sin trim para preservar su contenido exacto.
- No se convierte ningún error a cadena vacía.
- No se inventa SECRET_NOT_FOUND: la documentación oficial no acredita un código estable de ausencia.

Consumidores corregidos:
- events.js ya no cachea un NIF vacío si falla la lectura del secreto. La rama de rectificación puede registrar recuperación cuando la obtención del emisor falla.
- horario.web.js ya no transforma la ausencia de clave HMAC en una lista de firmas simplemente no verificadas. Si existen fichajes y no puede leerse la clave, la consulta falla con el código de secreto.

## Importes

- _roundMoney() rechaza null, undefined, booleanos, objetos, strings vacíos, NaN e infinitos con INVALID_MONEY_AMOUNT.
- bookingCore.js deja de convertir un total inválido a cero mediante Number(...) || 0. Solo usa 0 cuando el campo no está presente; un null explícito o un string inválido se rechazan.
- Se añade cobertura unitaria de redondeo y contrato estático del writer de reservas.

Pendiente de auditoría adicional:
- cajas.web.js conserva algunas conversiones explícitas Number(...) || 0 y _readPositiveAmount().
- fiscalAggregator.web.js usa un normalizador numérico local que convierte entradas no finitas en cero. Revisar por tipo de movimiento y obligatoriedad fiscal antes de cambiarlo.
- accountingLedger.js conserva un redondeador local con comportamiento distinto; analizar contratos y consumidores antes de unificar.

## Configuración TPV

Se eliminan duplicidades:
- TPV_RUNTIME_POLICY.CURRENCY
- TPV_RUNTIME_POLICY.CURRENCY_CODE
- TPV_RUNTIME_POLICY.TIME_ZONE

Todos los consumidores TPV usan SDK_CONFIG.CURRENCY_CODE y SDK_CONFIG.TZ, que son los valores canónicos del sitio. Se actualizan tests de contrato y se eliminan imports de política que quedaron sin uso.

## Evidencia

- PR #675 integra la fase previa de DAL/identidad: 89 suites / 804 tests PASS.
- CI de esta rama: pendiente.
- Wix Runtime/Preview y E2E: pendientes.
- El sitio sigue Draft/no publicado. No se publica ni se ejecutan cobros o escrituras fiscales reales.

## Fuente oficial

- Get Secret Value: https://dev.wix.com/docs/api-reference/business-management/secrets/get-secret-value
- Query Staff Members v1: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
