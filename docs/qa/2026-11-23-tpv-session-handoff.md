# Handoff TPV — 2026-11-23

Este archivo es un relevo breve, no una fuente de estado independiente. La jerarquía documental está en [docs/README.md](../README.md).

## Baseline de estabilización

- PR #543: corrección contractual TPV integrada.
- PR #544: reconciliación documental integrada.
- PR #545: estabilización documental; HEAD validado `c1e2cc086c5954b39b91ba7072d0fb5ab1b75ded`.
- La versión previa de la PR pasó Backend offline quality gates (run [45111242142](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242142)) y Secret scanning (run [45111242155](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242155)). Consultar PR #545 para el resultado del HEAD más reciente.
- La rama main sigue sin protección efectiva (#210).

## Estado TPV

El código y los contratos estáticos están integrados. No hay aceptación Wix Preview/Runtime ni E2E. Los métodos BONO y TARJETA_REGALO son solo medios sintéticos; no representan canje de saldo ni pagos reales. Los writers nativos/fiscales y pagos reales permanecen deshabilitados.

## Siguiente trabajo

1. Resolver CajaActual/concurrencia (#525) antes de aceptar operaciones concurrentes.
2. Conciliar compensaciones (#416) y maestro fiscal (#415) sin mutar históricos.
3. Contener y auditar las ocho automatizaciones ACTIVE (#520).
4. Completar la matriz Runtime de [aceptación TPV](TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md).
5. Mantener NO-GO hasta resolver los gates y verificar el SHA instalado en Wix.

## Referencias canónicas

- [Estado operativo](../PROJECT-STATUS.md)
- [Plan maestro](../MASTER-EXECUTION-PLAN.md)
- [Backlog](BACKLOG-RECONCILIATION-2026-11-23.md)
- [Auditoría Wix](2026-11-23-tpv-wix-audit-validation.md)
- [README backend TPV](../../src/backend/tpv/README.md)