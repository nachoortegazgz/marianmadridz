# Directrices vigentes del proyecto — Marian Madrid

**Fecha de consolidación:** 6 de noviembre de 2026  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Sitio:** `www.marianmadrid.es`

## 1. Objetivo

Construir y operar la actividad digital y presencial del salón con el menor coste recurrente y la menor complejidad posibles, priorizando:

1. Reservas online simples y duales.
2. Venta online y operaciones presenciales.
3. Caja y cobros mediante capacidades nativas disponibles.
4. Gestión documental y preparación de información para gestoría.
5. Cumplimiento legal aplicable en España.
6. Información empresarial útil para decidir.
7. Inventario como función secundaria, solo donde Wix no sea suficiente.

## 2. Arquitectura obligatoria

- **Wix + Wix Apps nativas** constituyen el centro operativo y la fuente de verdad para los procesos que cubran: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations.
- **Velo** implementa únicamente lógica de negocio imprescindible no cubierta de forma nativa. No crear un segundo sistema de reservas, ventas, pagos, CRM, caja o inventario.
- **Microsoft 365** es la capa documental externa. SharePoint conserva documentación y evidencias; no es ledger transaccional ni fuente de verdad operativa.
- Flujo documental previsto: **Wix backend → Power Automate → SharePoint**, sin correo intermedio y sin escritura de vuelta a Wix.
- La activación de Power Automate, conectores HTTP y autenticación Entra ID queda condicionada a verificar licencias, capacidades del tenant y ausencia de coste adicional.

## 3. Costes e integraciones

- No añadir integraciones, middleware, proveedores ni suscripciones externas por defecto.
- No incorporar proveedores externos de fiscalidad, contabilidad, POS, email, pagos o IA si Wix/M365 cubren la necesidad.
- Una excepción exige: necesidad legal o funcional demostrable, análisis de cobertura nativa, al menos una alternativa, coste inicial y recurrente, riesgos y aprobación explícita del propietario.
- No asumir que una licencia incluye un conector, API, automatización o función concreta. Verificarlo antes de diseñar como disponible.

## 4. Código y datos

- Preferir configuración y capacidades Wix frente a código propio.
- El CMS propio se reserva para configuración diferencial, relaciones o datos que Wix no gestione.
- Antes de crear un módulo o colección, documentar: necesidad, alternativa Wix evaluada, fuente de verdad, consumidores, retención, mantenimiento y riesgo.
- Antes de retirar código/campos/colecciones: auditar referencias, consumidores, históricos, hooks, automatizaciones, informes y rollback. No borrar sin autorización expresa.
- Mantener los contratos y nombres canónicos confirmados en el código y esquema QA; no inferirlos de documentación antigua.
- Secretos solo mediante mecanismos autorizados. No exponerlos ni sortear bloqueos.

## 5. Reservas

- Wix Bookings gestiona servicios, profesionales, disponibilidad y reservas simples siempre que la configuración nativa lo permita.
- Para servicios duales, el requisito diferencial es F1 → gap de exposición → F2, con mismo profesional y disponibilidad válida en ambas fases.
- Mantener orquestación Velo solo mientras Wix Bookings no ofrezca una solución nativa equivalente fiable. Debe incluir revalidación en servidor, idempotencia, bloqueo/compensación ante fallos y trazabilidad.
- No convertir F1 y F2 en una reserva multiservicio si el requisito es una secuencia con gap de tiempo.
- No declarar E2E real por tener tests offline o disponibilidad consultada.

## 6. Documentación M365

- SharePoint almacena paquetes documentales, justificantes y evidencias para consulta/entrega a gestoría.
- El diseño actual propone el sitio `MarianMadrid_Gestion` y la biblioteca `Registro_Documental_MarianMadridPeluqueria`; no constan como creados.
- No reutilizar IDs legacy ni endpoints antiguos sin auditoría.
- No usar email como transporte intermedio.
- La exportación debe ser mínima, trazable, segura y unidireccional. No enviar datos personales innecesarios.
- No declarar automatización operativa hasta verificar licencias, configuración, permisos y una prueba E2E autorizada.

## 7. Cumplimiento

- No afirmar cumplimiento legal total por disponer de una función técnica.
- Separar requisitos normativos, cobertura funcional de Wix/M365 y evidencia de cumplimiento.
- La facturación, conservación documental, registro horario, privacidad, pagos y obligaciones tributarias requieren validación normativa específica y, cuando corresponda, confirmación de gestoría/asesoría.
- No construir un motor fiscal paralelo como primera opción. Evaluar primero las funciones Wix disponibles y la vía documental M365; cualquier carencia legal debe documentarse y aprobarse antes de elegir una solución adicional.

## 8. Seguridad, QA y publicación

- No tocar producción ni CMS de producción sin autorización expresa.
- No ejecutar operaciones económicas reales, reservas, pagos, devoluciones, emails ni automatizaciones activas sin autorización.
- No ejecutar Wix Preview, Publish ni despliegues; los realiza manualmente el propietario.
- Diferenciar pruebas offline (mocks), QA/Preview y E2E real. No presentar una como otra.
- CI verde demuestra únicamente los checks incluidos en ese run y para el commit probado.
- Registrar rama, SHA, PR, CI, pruebas, limitaciones y estado runtime. No afirmar que un commit está publicado en Wix sin evidencia.

## 9. Regla para decisiones técnicas

Antes de implementar, responder en este orden:

1. ¿Wix o una Wix App nativa ya resuelve el caso?
2. ¿La licencia/país/configuración disponible incluye esa función?
3. ¿Puede resolverse con M365 ya contratado?
4. ¿Es realmente imprescindible código Velo?
5. ¿Qué datos y procesos se duplicarían?
6. ¿Qué coste, riesgo, mantenimiento y obligaciones añade?
7. ¿Existe evidencia y aprobación para proceder?

Si no hay evidencia suficiente, dejar la decisión como pendiente y no inventar capacidades ni resultados.
