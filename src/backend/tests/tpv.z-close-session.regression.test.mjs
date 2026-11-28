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
