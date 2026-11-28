import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

test("Ticket Z closes the physical cash projection and writes one CIERRE movement", async () => {
    const cierres = await source("src/backend/tpv/tpvCierres.web.js");
    assert.match(cierres, /closeTpvCajaSessionProjection/);
    assert.match(cierres, /async function persistTpvSessionClose\(/);
    assert.match(cierres, /wql\.and\(wql\.eq\("sessionId", sessionId\), wql\.eq\("movementType", "CIERRE"\)\)/);
    assert.match(cierres, /sessionId \+ "-CIERRE"/);
    assert.match(cierres, /movementType: "CIERRE"/);
    assert.match(cierres, /await closeTpvCajaSessionProjection\(/);
    assert.match(cierres, /await persistTpvSessionClose\(\{[\s\S]*?sessionId: session\.sessionId/);
    const summaryCore = await source("src/backend/tpv/tpvCierresCore.js");
    const html = await source("%23htmlTPV.txt");
    assert.match(summaryCore, /getPendingTpvSales\(session\.sessionId\)/);
    assert.match(summaryCore, /pendingSalesCount: pendingSales\.length/);
    assert.match(summaryCore, /pendingSalesGrossMinor/);
    assert.match(cierres, /pendingSalesCount: Number\(totals\.pendingSalesCount \|\| 0\)/);
    assert.match(cierres, /pendingSalesGross: fromMinorUnits\(Number\(totals\.pendingSalesGrossMinor \|\| 0\)\)/);
    assert.match(html, /ventas pendientes de cobro/);
});

test("Ticket Z retry repairs a missing physical closure without duplicating it", async () => {
    const cierres = await source("src/backend/tpv/tpvCierres.web.js");
    const noSessionBranch = cierres.slice(
        cierres.indexOf("if (!session && requestedSessionId)"),
        cierres.indexOf("if (!session) throw new Error")
    );
    assert.match(noSessionBranch, /priorClosedAt/);
    assert.match(noSessionBranch, /await persistTpvSessionClose\(\{/);
    assert.match(noSessionBranch, /prior\.totals\?\.operatorId/);
    assert.match(cierres, /if \(priorMovements\.length > 1\) throw new Error\("TPV_CLOSE_MOVEMENT_DUPLICATE"\)/);
    assert.match(cierres, /TPV_IDEMPOTENCY_CONFLICT/);
});

test("authorized TPV roles can open a session while singleton bootstrap remains ADMIN-only", async () => {
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    const permissions = await source("src/backend/tpv/tpvPermisos.web.js");
    const openStart = caja.indexOf("export const abrirSesionCaja = webMethod(");
    const openEnd = caja.indexOf("export const registrarArqueoParcial = webMethod(", openStart);
    const openBlock = caja.slice(openStart, openEnd);
    const initStart = caja.indexOf("export const inicializarCaja = webMethod(");
    const initEnd = caja.indexOf("export const obtenerEstadoCaja = webMethod(", initStart);
    const initBlock = caja.slice(initStart, initEnd);
    assert.match(openBlock, /await requireTpvOperator\(traceId\)/);
    assert.doesNotMatch(openBlock, /await requireAdmin\(traceId\)/);
    assert.match(initBlock, /await requireAdmin\(traceId\)/);
    assert.match(permissions, /openSession: true/);
});
