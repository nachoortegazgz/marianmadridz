# Preparación para pruebas online — 2026-11-20

## 1. Estado

**Main:** bcb5a1d6467bcd0f7a0cf1b28a5c03dbbb226479.  
**CI offline:** PASS (regresión, capas 1 y 2, SDK, ESLint).  
**Gitleaks:** PASS.  
**Workflow Preview:** manual opt-in, desactivado por defecto; no se reintenta automáticamente mientras Wix no resuelva el pipeline.  
**Hito online:** NO ALCANZADO. No existe URL de Preview ni informe Playwright PASS.

## 2. Evidencia de Wix

- Site ID: 188bed94-177c-4bc9-a9f0-35080d874f3e.
- UI version: 15941.
- Wix CLI for Sites 1.2.14 y Node 24.22.1 instalados correctamente.
- CLI_API_KEY existe y la autenticación Wix funciona.
- El Site Context devuelve estado Draft.
- La ayuda real del CLI incluye --source <local|remote>.
- El primer intento interactivo llegó a seleccionar Latest commit from the default branch y falló al consultar la tarea de despliegue.
- El segundo intento, usando explícitamente --source remote, reprodujo el mismo fallo:
  - HTTP 404.
  - Código PUBLISH_PIPELINE_TASK_NOT_FOUND.
  - Deployment ID: 320d133e-284c-46f3-9fe8-edd96cf8274d.
  - Request ID: 1795210627.56413478193221476.
  - Endpoint: GET https://editor.wix.com/_api/editor-deployments/v1/deployments/pipeline/320d133e-284c-46f3-9fe8-edd96cf8274d.
- No se obtuvo URL wix.to. Playwright no llegó a ejecutarse.

El estado Draft y el error indican que Wix no tiene una tarea de pipeline resoluble para este intento. No permiten afirmar por sí solos si nunca hubo una publicación o si el registro de despliegue está obsoleto/corrupto. La URL pública del dominio tampoco demuestra que exista un pipeline CLI válido para este Site ID.

## 3. Cambios integrados

- Workflow manual opt-in en .github/workflows/wix-tpv-preview.yml.
- Site ID/UI version validados.
- CLI y Node fijados.
- Source remoto explícito mediante npm run wix preview -- --source remote.
- Nunca se ejecuta wix publish.
- Smoke Playwright 1.65.1 aislado de las dependencias del sitio.
- El smoke solo navega; bloquea métodos no seguros y rutas API dinámicas conocidas, no pulsa controles ni envía formularios.
- El informe no guarda mensajes que puedan contener datos personales.
- El driver PTY temporal se eliminó al comprobar que --source remote permite evitar el selector interactivo.

Se retiró el disparo automático workflow_run para no repetir una llamada Wix que devuelve el mismo 404. El workflow queda disponible manualmente, con create_preview=false por defecto, cuando el requisito externo esté resuelto.

## 4. Límites de seguridad

Wix Preview CLI no equivale a un Wix Test Site ni garantiza aislamiento de colecciones. Las HTTP Functions pueden ejecutarse en versión LIVE. El smoke no prueba operaciones de backend, permisos, Apps nativas ni persistencia.

No se ha:
- publicado el sitio;
- modificado CMS o Wix Apps;
- creado reservas, ventas, pagos, devoluciones, tickets, facturas o fichajes;
- escrito ledgers;
- enviado formularios ni notificaciones;
- ejecutado hardware ni pagos reales.

## 5. Condición pendiente para alcanzar el hito

Hace falta una infraestructura Wix que pueda crear un Preview sin tocar producción. Las rutas viables son:

1. **Recomendada: sitio Wix independiente de pruebas**, con las Apps necesarias, colecciones propias, datos sintéticos y permisos de QA. Evita publicar el sitio principal y evita que las colecciones de producción se compartan.
2. Resolver con Wix el pipeline del sitio actual o autorizar una publicación inicial controlada si Wix confirma que es el prerrequisito. No se ejecutará sin autorización específica.

Una vez disponible el entorno:
- crear URL Preview;
- ejecutar smoke Playwright;
- validar que el informe sea PASS;
- solo después diseñar pruebas transaccionales contra el sitio independiente y fixtures sintéticas.

**Release:** NO-GO para publicación y transacciones.  
**Online smoke:** preparado en código, bloqueado por el estado de despliegue Wix.