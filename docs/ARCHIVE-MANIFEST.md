# Archivo histórico

La documentación operativa se limita a [INDEX.md](INDEX.md) y a los documentos que enlaza. El directorio `docs/archive/2026-11/` conserva decisiones, auditorías, snapshots de CMS, contratos y handoffs fechados que permiten reconstruir por qué se tomaron decisiones y qué se observó en cada momento.

## Política

- El archivo no es fuente operativa ni prueba del estado actual.
- No copiar snapshots antiguos al estado actual sin revalidar contra Wix/CMS.
- No borrar evidencia de decisiones de arquitectura, seguridad, integridad fiscal/contable, contratos CMS ni resultados de auditoría que expliquen cambios.
- Los planes duplicados, checklists superados y handoffs repetidos pueden retirarse del árbol activo; Git conserva el historial de los cambios.
- Ante contradicción, prevalecen documentación oficial vigente, código integrado, pruebas ejecutadas y lecturas fechadas del entorno correspondiente.

## Consolidación documental — 2026-11-27

- Se retiraron del árbol activo los documentos de milestone duplicados, páginas de redirección y dossier técnico monolítico. Las decisiones vigentes permanecen en PROJECT-CANON, STATE-NOW, RELEASE-READINESS y TPV-UNIFIED-FLOW.
- La auditoría TPV anterior a PR #640 se conserva marcada como baseline previo a la corrección.
- El readiness TPV antiguo se conserva en archivo como evidencia histórica, no como procedimiento vigente.
- El diccionario CMS extenso y ESQUEMA_CMS histórico se conservan en archive como evidencia; el baseline físico vigente es [ESQUEMA_CMS](../ESQUEMA_CMS.md), actualizado mediante lectura Wix read-only del 27-11-2026.
- No se ha eliminado código ejecutable ni se ha cambiado lógica de negocio en esta limpieza documental.
