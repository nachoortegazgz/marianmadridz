# Backend — Marian Madrid

El backend contiene los Web Modules Velo, los manejadores de eventos, los hooks CMS, los trabajos programados y los módulos internos compartidos.

## Web Modules

Los módulos invocables desde frontend usan exclusivamente archivos `.web.js` y declaran el nivel de acceso en cada exportación mediante `webMethod(Permissions...)`.

- `Permissions.Anyone`: solo para operaciones públicas cuyo DTO y validaciones están diseñados para visitantes anónimos.
- `Permissions.SiteMember`: requiere una sesión de miembro Wix.
- `Permissions.Admin`: reservado a operaciones administrativas para propietarios y colaboradores autorizados.

La autorización de negocio se vuelve a comprobar en backend. La identidad, el rol y la propiedad de una reserva nunca se aceptan desde el payload del navegador.

Documentación oficial:
- [Web Modules y web methods](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/backend-code/web-modules/about-web-modules)
- [Permisos de web methods](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/backend-code/web-modules/about-web-modules#permissions)

## Wix Data y hooks CMS

`data.js` contiene los hooks asociados a las colecciones CMS. Las validaciones de esquema residen en `validation.js`; el acceso a CMS se centraliza en `dataAccess.js`.

Los hooks `beforeUpdate` reciben el elemento que se va a actualizar y el contexto de la operación. Los hooks `beforeRemove` reciben el identificador del elemento. Si una regla depende del estado persistido, el hook recupera el registro por ID con lectura fuerte antes de decidir.

Documentación oficial:
- [Wix Data hooks](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update)
- [Wix Data beforeRemove](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-remove)

## Backend events

`events.js` implementa manejadores de eventos Velo gestionados por Wix. Wix entrega al manejador el objeto de evento ya verificado y decodificado. El módulo exige ese objeto y no expone un endpoint HTTP para recibir JWT.

La entrega de eventos es asíncrona y puede repetirse; cada manejador debe ser idempotente mediante `eventId` y el registro inmutable `WEBHOOK_EVENT`.

Documentación oficial:
- [Wix backend events](https://dev.wix.com/docs/overview/backend-services/events)
- [Definir backend event handlers](https://dev.wix.com/docs/develop-websites-sdk/code-your-site/build-a-custom-backend/backend-events/define-backend-event-handlers)

## Scheduled jobs

`jobs.config` declara los trabajos programados. Las funciones correspondientes se implementan y exportan desde los módulos backend indicados por cada job.

## Estructura de responsabilidades

| Archivo / carpeta | Responsabilidad |
|---|---|
| `internalConfig.js` | Constantes, enums y contratos canónicos |
| `validation.js` | Validaciones puras de DTO y esquemas CMS |
| `dataAccess.js` | Acceso centralizado y elevado a Wix Data |
| `data.js` | Hooks de integridad CMS |
| `security.js` | Identidad de miembro, roles y rate limiting |
| `events.js` | Eventos backend Velo de Wix |
| `booking/` | Primitivas y sagas de reservas |
| `tests/` | Suites offline y contratos de regresión |

No existe ningún módulo `.jsw` en este backend. Por tanto, `permissions.json` no forma parte del modelo de autorización: Wix documenta ese manifiesto para módulos `.jsw`; los módulos actuales aplican permisos en sus declaraciones `webMethod`.
