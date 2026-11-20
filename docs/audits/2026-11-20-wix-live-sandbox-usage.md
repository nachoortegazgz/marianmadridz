# Wix LIVE/SANDBOX usage snapshot — 2026-11-20

**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Main at audit time:** `03a67652d87298855aec70d43b2ac44fa5024994`  
**Method:** Wix Site Data Usage API, read-only, with the API's returned per-environment collection usage.

## Official semantics

Wix documents that each site has two Wix Data environments:
- LIVE: data served to visitors of the published site.
- SANDBOX: a separate copy used by the site editor and preview.

Source: [About the Site Data Usage API — LIVE and SANDBOX environments](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction).

The API reports current storage and item usage separately for both environments. The API is a usage report, not a per-request runtime attestation.

## Observed usage

Site totals:
- LIVE: 201 items, 264,970 bytes.
- SANDBOX: 107 items, 204,766 bytes.

| Collection | LIVE items | SANDBOX items |
|---|---:|---:|
| CajaActual | 1 | 1 |
| MovimientosCaja | 0 | 0 |
| TpvSandboxIdentities | 0 | 0 |
| ControlOperativo | 58 | 0 |
| HistoricoCierresZ | 0 | 0 |
| CitasF2 | 6 | 6 |
| ServiciosCatalogo | 95 | 95 |
| MapaStaff | 5 | 5 |
| ComplementosCatalogo | 36 | 0 |
| PaquetesGestoria | 0 | 0 |
| RegistroIntegracion | 0 | 0 |
| RegistrosHorariosStaff | 0 | 0 |
| LibroAsientosContablesDetalle | 0 | 0 |

Counts sum to the API-reported totals (201 LIVE / 107 SANDBOX).

## Interpretation

**Verified**
- The site has distinct LIVE and SANDBOX Wix Data usage totals.
- Sandbox contains 107 items, including one CajaActual item.
- Sandbox currently contains zero items in MovimientosCaja, TpvSandboxIdentities, ControlOperativo and HistoricoCierresZ.
- LIVE contains 58 ControlOperativo items and zero MovimientosCaja/HistoricoCierresZ items.

**Not established**
- This usage API does not reveal the item contents or IDs in Sandbox.
- It does not identify the current execution environment of a particular backend WebMethod invocation.
- It does not prove that a direct invocation from the published site cannot reach LIVE.

## Release decision and next safe step

Keep `TPV_QA_RUNTIME_POLICY.ENABLED=false` until a server-side guard is proven. The most constrained next test is to establish a unique, immutable Sandbox-only proof marker in an existing CMS collection via the Editor's Sandbox environment, then make every mutating TPV WebMethod read and validate that marker through the same Velo data context before any write. A published-site invocation must fail because its LIVE dataset does not contain the marker. The marker must not be seeded through an unguarded WebMethod, because such a method could write it into LIVE.

After that, test:
1. Preview backend reads the marker and can write only synthetic test-run rows.
2. Published/direct WebMethod invocation fails before any CMS mutation.
3. LIVE usage and item snapshots remain unchanged.
4. All test-run operations remain idempotent and append-only.

No data was modified during this audit. No seed/bootstrap, Wix Editor action, code deployment or site publication was performed.
