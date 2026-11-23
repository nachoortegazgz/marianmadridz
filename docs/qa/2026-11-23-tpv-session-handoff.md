# Handoff TPV — 2026-11-23

Este archivo es un relevo breve, no una fuente de estado independiente. La jerarquía documental está en [docs/README.md](../README.md).

## Baseline de estabilización

- PR #543: corrección contractual TPV integrada.
- PR #544: reconciliación documental integrada.
- PR #545: estabilización documental fusionada; merge commit main `9dbeacfc505bdfb58e8e1cdf9d566c8662cda739`.
- CI pre-merge del HEAD `57013eed25a5f8c755a2e5cd3434c792b3dec78c`: backend run [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881), Gitleaks run [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897), ambos SUCCESS.
- CI post-merge del main HEAD: backend run [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859), Gitleaks run [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890), ambos SUCCESS.
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