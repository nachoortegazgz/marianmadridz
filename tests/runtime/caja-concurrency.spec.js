/*
WIX PREVIEW RUNTIME TEST — Caja concurrency / P1
Purpose: invoke the real backend WebMethods concurrently; never writes native
payments or fiscal ledger records. abrirSesionCaja persists a synthetic
CajaActual session, so execute only on a QA site with no open session today.

Prerequisites:
- Preview member authenticated as a site member with the ADMIN website role.
- CajaActual singleton already initialized with the canonical TPV runtime policy.
- No TPV session currently open for the current Europe/Madrid business day.
- The backend calculates dayKey on the server; caller-supplied dayKey is not trusted.
  The two requests therefore race on the same canonical dayKey with distinct
  requestId, terminalId and reason values.
- Use a disposable QA site; this test intentionally opens one synthetic session
  and does not attempt to delete or roll it back.

Wix Preview execution:
1. In the TPV page code (temporary QA-only invocation), import:
   import { abrirSesionCaja, obtenerEstadoCaja } from "backend/tpv/tpvCaja.web";
2. Paste/import this module's exported runCajaConcurrencyPreviewTest function
   into that QA page code (the tests/ directory is not a deployed Velo module).
3. Execute exactly:
   await runCajaConcurrencyPreviewTest({ abrirSesionCaja, obtenerEstadoCaja });

Expected invariant:
- countAntes === 0 and countDespues === 1.
- At most one call returns SUCCESS; the other returns TPV_SESSION_IN_PROGRESS
  or TPV_IDEMPOTENCY_CONFLICT (a replay is also acceptable if the same
  fingerprint wins). No second session is created.
*/

function _sessionCount(stateResult) {
    if (stateResult?.status !== "SUCCESS") {
        throw new Error("TPV_STATE_READ_FAILED:" + String(stateResult?.error?.code || "UNKNOWN"));
    }
    return stateResult.data?.operationalStatus === "ABIERTA" ? 1 : 0;
}

export async function runCajaConcurrencyPreviewTest({ abrirSesionCaja, obtenerEstadoCaja } = {}) {
    if (typeof abrirSesionCaja !== "function" || typeof obtenerEstadoCaja !== "function") {
        throw new Error("TPV_PREVIEW_WEBMETHODS_REQUIRED");
    }

    const before = await obtenerEstadoCaja();
    const countAntes = _sessionCount(before);
    if (countAntes !== 0 || before.data?.canOpenSession !== true) {
        throw new Error("TPV_PREVIEW_PRECONDITION_CANNOT_OPEN_SESSION");
    }

    const requestId1 = "QA-CJA-" + Date.now() + "-1";
    const requestId2 = "QA-CJA-" + Date.now() + "-2";
    const [llamada1, llamada2] = await Promise.all([
        abrirSesionCaja({
            openingCash: 100,
            reason: "QA concurrency " + requestId1,
            terminalId: requestId1,
            requestId: requestId1,
            dayKey: "UNTRUSTED-" + requestId1,
        }),
        abrirSesionCaja({
            openingCash: 100,
            reason: "QA concurrency " + requestId2,
            terminalId: requestId2,
            requestId: requestId2,
            dayKey: "UNTRUSTED-" + requestId2,
        }),
    ]);

    const after = await obtenerEstadoCaja();
    const countDespues = _sessionCount(after);
    const lockLog = [llamada1, llamada2].map((result, index) => ({
        requestId: index === 0 ? requestId1 : requestId2,
        requestedDayKey: "UNTRUSTED-" + (index === 0 ? requestId1 : requestId2),
        status: result?.status || null,
        errorCode: result?.error?.code || null,
        replayed: result?.data?.replayed === true,
        traceId: result?.traceId || null,
    }));
    const report = {
        llamada1,
        llamada2,
        countAntes,
        countDespues,
        lockLog,
    };
    console.log(JSON.stringify(report, null, 2));

    if (countDespues !== 1) {
        throw new Error("TPV_CONCURRENCY_INVARIANT_FAILED:" + JSON.stringify(report));
    }
    const successCount = [llamada1, llamada2].filter((result) => result?.status === "SUCCESS").length;
    if (successCount !== 1 &&
        !(successCount === 2 && [llamada1, llamada2].every((result) => result?.data?.replayed === true))) {
        const acceptedLockErrors = new Set(["TPV_SESSION_IN_PROGRESS", "TPV_IDEMPOTENCY_CONFLICT"]);
        const errors = [llamada1, llamada2].filter((result) => result?.status === "ERROR");
        if (!(successCount === 1 && errors.length === 1 && acceptedLockErrors.has(errors[0]?.error?.code))) {
            throw new Error("TPV_CONCURRENCY_RESULT_UNEXPECTED:" + JSON.stringify(report));
        }
    }
    return report;
}
