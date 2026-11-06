# Flujos end-to-end — Capa documental Wix → Microsoft 365

**Proyecto:** Marian Madrid Peluquería y Estética  
**Fecha de diseño:** 6 de noviembre de 2026  
**Estado:** arquitectura propuesta; SharePoint y Power Automate aún no creados ni validados.

## 1. Propósito y límites

La Capa 3 organiza y conserva documentación operativa para consulta y entrega a gestoría. No sustituye a Wix como sistema operativo ni crea un ERP, CRM, contabilidad, caja o inventario paralelo.

- **Fuente de verdad operativa:** Wix y sus Wix Apps nativas.
- **Destino documental:** SharePoint en Microsoft 365.
- **Orquestación prevista:** Power Automate.
- **Dirección:** unidireccional, Wix backend → Power Automate → SharePoint.
- **Sin correo intermedio.**
- SharePoint no escribe de vuelta a Wix ni decide el estado de reservas, pedidos, pagos o caja.

La solución debe aprovechar las licencias ya contratadas. No activar conectores Premium, servicios externos o planes adicionales sin identificar el coste y obtener aprobación.

## 2. Arquitectura lógica

```text
Wix Apps nativas + Velo mínimo
          |
          | evento/exportación autorizada
          v
Wix backend
          |
          | HTTPS autenticado
          v
Power Automate (trigger HTTP)
          |
          | validación + idempotencia + clasificación
          v
SharePoint
          |
          v
Archivo documental / consulta / entrega a gestoría
```

Power Automate solo se utilizará si el tenant dispone del trigger, conectores y autenticación necesarios con licencia suficiente. La autenticación preferida es Microsoft Entra ID cuando el trigger y la configuración del tenant lo permitan. La alternativa no se decide por adelantado: debe compararse con las capacidades realmente disponibles, sin degradar seguridad ni introducir coste no aprobado.

## 3. Componentes y estado

| Componente | Diseño | Estado |
|---|---|---|
| Wix | Fuente de datos y eventos | Operativa como plataforma; exportación Capa 3 pendiente |
| Wix backend | Preparar y transmitir documentos mínimos | Pendiente de implementación/validación |
| Power Automate | Trigger HTTP, validación y creación documental | No creado |
| SharePoint site | `MarianMadrid_Gestion` | Propuesto; no creado |
| Biblioteca | `Registro_Documental_MarianMadridPeluqueria` | Propuesta; no creada |
| Identidad | Microsoft Entra ID | Pendiente de verificar tenant/licencia/configuración |
| E2E | Wix → Power Automate → SharePoint | No probado |

No asumir que la licencia Microsoft 365 incluye HTTP trigger, conectores premium, capacidad de ejecución o autenticación concreta. Verificarlo en el tenant antes de configurar el flujo.

## 4. Categorías documentales previstas

La exportación se limita a documentos necesarios y justificables para administración/gestoría. Las categorías son una clasificación de destino, no una segunda base de datos transaccional.

| Categoría | Origen preferente | Tratamiento |
|---|---|---|
| Ventas y pedidos | Wix Stores/eCommerce | Resumen/documentos disponibles, sin replicar el pedido como sistema operativo |
| Reservas y servicios | Wix Bookings | Evidencia o resumen solo cuando sea necesario |
| Cobros y cierres | Wix Payments/POS y registros disponibles | Documentación conciliable; no crear ledger paralelo en SharePoint |
| Gastos | Documentación aportada por la empresa | Archivo documental manual o flujo aprobado |
| Personal y jornada | Sistema válido que se determine | Datos mínimos; no asumir que Bookings cubre el registro horario legal |
| Inventario | Wix Stores | Exportar solo informes o evidencias necesarias |

La estructura definitiva de carpetas, metadatos y periodos se define después de confirmar requisitos de gestoría, permisos y retención. No crear una taxonomía compleja anticipadamente.

## 5. Contrato de transporte: requisitos

El payload definitivo no se fija hasta conocer los documentos concretos y el trigger disponible. Como mínimo, el contrato deberá contemplar:

- Identificador estable del evento/documento para idempotencia.
- Tipo documental y versión del esquema.
- Fecha/hora ISO 8601 con zona horaria explícita.
- Identificador de origen Wix y referencia del objeto, sin duplicar innecesariamente sus datos.
- Periodo contable/operativo cuando corresponda.
- Nombre y tipo MIME del archivo o contenido documental.
- Metadatos mínimos necesarios para clasificación y búsqueda.
- Identificador de correlación para trazabilidad.
- Política de reintento y resultado de procesamiento.

No incluir secretos, datos de tarjeta ni datos personales que no sean imprescindibles. Evitar adjuntar bases completas de clientes, staff o reservas. El esquema debe validarse en backend antes de transmitir.

## 6. Seguridad, idempotencia y errores

1. Autenticar el emisor con el mecanismo admitido y configurado por Microsoft.
2. Autorizar solo el flujo y biblioteca necesarios.
3. Validar tipo, tamaño, estructura y metadatos de cada entrada.
4. Deduplicar por identificador de evento/documento y origen.
5. Registrar resultado, correlación, fecha y error sin volcar información sensible.
6. Reintentar solo errores transitorios; los errores de validación deben quedar en cuarentena/revisión.
7. Evitar que un reintento genere documentos duplicados.
8. Aplicar permisos mínimos en SharePoint y separar administración de consulta externa.
9. Definir retención y borrado conforme a obligaciones legales y política documental, no por conveniencia técnica.

No crear una ruta de entrada pública sin autenticación. No desactivar validaciones ni controles para resolver errores.

## 7. Configuración y secretos

Estado de secretos tras la poda de código propuesta en PR #151:

- `M365_POWER_AUTOMATE_ENDPOINT`: no está configurado ni mapeado en `mmSecrets.js`; se definirá cuando exista el flujo aprobado.
- Los mapeos legacy sin consumidores de Microsoft Graph y `POWER_AUTOMATE_TOKEN` se retiraron de `mmSecrets.js`.
- También se retiraron del código los mapeos de OpenAI, Resend y SendGrid, al eliminar esas integraciones opcionales.
- La poda afecta al código del repositorio: **no elimina los registros reales de secretos almacenados en Wix Secrets Manager**. Su borrado requiere una auditoría y autorización separadas.
- No hay integración Graph ni flujo Power Automate activo. No reutilizar IDs ni endpoints legacy.

No intentar sortear los controles de seguridad de Wix Secrets Manager. No copiar secretos a documentación, issues, logs ni código.

## 8. Procedimiento de implantación

### Fase 0 — Verificación previa

- Confirmar licencias y tenant M365.
- Confirmar disponibilidad y coste del trigger HTTP y conectores necesarios.
- Confirmar autenticación Entra ID y permisos.
- Acordar con gestoría documentos, periodicidad, formato y retención.
- Identificar categorías con datos personales y su base/justificación.
- Obtener aprobación del propietario antes de crear recursos o activar flujos.

**Puerta de decisión:** si la solución requiere un coste adicional, detenerse y presentar coste y alternativas antes de continuar.

### Fase 1 — SharePoint

- Crear el sitio y biblioteca solo tras la aprobación.
- Configurar propietarios, permisos mínimos, versionado y retención.
- Validar acceso de la empresa y, si procede, acceso de consulta de gestoría.
- No reutilizar IDs legacy sin auditoría.

### Fase 2 — Power Automate

- Crear un flujo de recepción HTTP con autenticación compatible.
- Validar el esquema, el tipo documental y el identificador idempotente.
- Crear el archivo en la biblioteca y devolver/registrar resultado de procesamiento.
- Configurar manejo de errores y alertas dentro de las capacidades incluidas en la licencia.

### Fase 3 — Wix

- Implementar únicamente la exportación mínima necesaria.
- Guardar endpoint y credenciales en mecanismos autorizados.
- No activar cron ni automatizaciones de producción sin aprobación.
- No duplicar la lógica transaccional que ya resuelve Wix.

### Fase 4 — Pruebas controladas

- Usar datos ficticios o anonimizados.
- Probar autenticación, esquema inválido, duplicado, timeout, reintento, permisos y archivo final.
- Verificar que el reintento no duplica documentos.
- Verificar que no se modifica ningún registro Wix.
- Ejecutar E2E solo con autorización y registrar evidencia reproducible.

### Fase 5 — Operación

- Revisar fallos y documentos pendientes.
- Conciliar por referencias de origen, sin convertir SharePoint en ledger.
- Entregar a gestoría según calendario acordado.
- Revisar periódicamente permisos, retención, licencias y funcionamiento.

## 9. Criterios de aceptación

La Capa 3 solo podrá declararse operativa cuando se demuestre todo lo siguiente:

- Licencias y costes confirmados, sin cargos no aprobados.
- Sitio/biblioteca y permisos configurados.
- Trigger y autenticación funcionando.
- Wix transmite únicamente documentos autorizados.
- Idempotencia y reintentos comprobados.
- Archivo correcto y legible en SharePoint.
- Trazabilidad desde origen hasta destino.
- No hay escritura de vuelta ni alteración de operaciones Wix.
- Retención y acceso revisados con gestoría/asesoría cuando corresponda.

Hasta entonces, el estado es **diseño pendiente de implantación**, no integración activa.

## 10. Decisiones pendientes

1. Confirmar licencias M365 y capacidades exactas de Power Automate.
2. Confirmar si el trigger HTTP requiere licencia/conector adicional.
3. Confirmar el mecanismo Entra ID compatible con el trigger.
4. Acordar con gestoría el conjunto documental y la periodicidad.
5. Aprobar la creación del sitio y biblioteca.
6. Definir payload y metadatos mínimos por documento.
7. Revisar los secretos/IDs legacy y sus consumidores antes de cualquier cambio.

## 11. Principio rector

Wix registra y gobierna la operación. M365 conserva la documentación necesaria. Power Automate conecta ambos solo si está incluido y autorizado. No se añade un sistema externo ni se duplica información operativa sin necesidad demostrable.
