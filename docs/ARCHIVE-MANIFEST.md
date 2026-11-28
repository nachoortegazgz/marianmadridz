# Archivo histórico

La documentación activa y su jerarquía se encuentran en [AI-ENTRYPOINT](AI-ENTRYPOINT.md), [AI-INDEX](AI-INDEX.md) y [INDEX](INDEX.md). El directorio `docs/archive/2026-11/` conserva decisiones, auditorías, snapshots de CMS, contratos y handoffs fechados que permiten reconstruir por qué se tomaron decisiones y qué se observó en cada momento.

## Política

- El archivo no es fuente operativa ni prueba del estado actual.
- No copiar snapshots antiguos al estado actual sin revalidar contra Wix/CMS.
- No borrar evidencia de decisiones de arquitectura, seguridad, integridad fiscal/contable, contratos CMS ni resultados de auditoría que expliquen cambios.
- Los planes duplicados, checklists superados y handoffs repetidos pueden retirarse del árbol activo; Git conserva el historial de los cambios.
- Ante contradicción, aplicar la autoridad por dominio de [AI-ENTRYPOINT](AI-ENTRYPOINT.md): propietario para objetivos/autorizaciones; documentación oficial Wix/proveedor para contratos; canon y contratos vigentes para arquitectura/dominio; código, pruebas y lecturas fechadas para implementación y comportamiento.
- Un documento histórico puede contener una decisión todavía vigente, pero debe comprobarse si existe una instrucción o ADR posterior.
- Los handoffs y snapshots no deben cargarse por defecto en el contexto IA. Recuperar solo el material relacionado con la tarea.

## Consolidación documental — 2026-11-27 y 2026-11-28

- Los documentos operativos se consolidan en `docs/STATE-NOW.md`, `docs/PROJECT-CANON.md`, `docs/TPV-UNIFIED-FLOW.md`, `docs/RELEASE-READINESS.md` y `docs/ESQUEMA_CMS.md`.
- [AI-ENTRYPOINT](AI-ENTRYPOINT.md) y [AI-INDEX](AI-INDEX.md) son las guías de recuperación consultiva; no duplican contratos ni evidencia.
- La auditoría TPV anterior a PR #640 se conserva marcada como baseline previo a la corrección.
- El readiness TPV antiguo se conserva en archivo como evidencia histórica, no como procedimiento vigente.
- El diccionario CMS extenso y ESQUEMA_CMS histórico se conservan en archive como evidencia; el baseline físico vigente es [ESQUEMA_CMS](ESQUEMA_CMS.md), actualizado mediante lectura Wix read-only del 27-11-2026.
- El dossier consolidado de la raíz se mantiene como resumen ejecutivo corto; no debe evolucionar como un segundo dossier técnico.
- No se elimina código ejecutable ni evidencia histórica como parte de esta reorganización documental.


## Segunda pasada documento a documento — 2026-11-28

- [Registro de revisión individual](archive/2026-11/ARCHIVE-REVIEW-2026-11-28.md): 161 archivos inventariados, clasificados y asignados a un tratamiento.
- No se detectaron duplicados binarios exactos por SHA de blob. Sí se identificaron solapamientos semánticos entre estados, dossiers, ADR, auditorías y handoffs.
- Se mantienen los archivos en sus rutas originales para no romper referencias históricas ni perder evidencia. Los documentos supersedidos se conservan expresamente como antecedentes, no se reactivan.
- Se actualizó el índice del archivo para retirar la falsa jerarquía operativa de noviembre y dirigir al punto de entrada IA actual.
- Se redactaron contactos personales y un identificador de credencial encontrados en documentación histórica. No se modificó la configuración activa ni se tocaron secretos.
- El dossier de flujos Capa 1–3 se conserva como diseño histórico de valor; no acredita la existencia de integraciones M365/SharePoint/Power Automate ni aceptación Runtime.
- El diccionario CMS de 300 KB y la verificación del 23-11 se conservan, pero no son esquema vigente: prevalece `docs/ESQUEMA_CMS.md`.
