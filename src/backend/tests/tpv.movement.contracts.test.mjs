import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    buildCashMovementFailure,
    buildCashMovementSuccessData,
    createPersistedTpvProjectionError,
    resolveCashSessionOperationalStatus,
} from "../tpv/tpvMovementContracts.js";

test("TPV movement response uses the active session status", () => {
    const data = buildCashMovementSuccessData({
        item: { _id: "movement-1" },
        session: { sessionId: "session-1", status: "ABIERTA" },
        movementType: "ENTRADA",
        amountMinor: 1250,
        operator: { operatorId: "operator-1", actorId: "member-1" },
        replayed: false,
        timeZone: "Europe/Madrid",
        now: new Date("2026-11-24T10:00:00.000Z"),
    });
    assert.equal(data.operationalStatus, "ABIERTA");
    assert.equal(data.amount, 12.5);
    assert.equal(data.persisted, true);
    assert.equal(data.replayed, false);
    assert.equal(data.isSynthetic, undefined);
    assert.equal(data.realPayment, undefined);
    assert.equal(data.simulationStatus, undefined);
});

test("TPV movement session status resolves closed historical sessions", () => {
    assert.equal(
        resolveCashSessionOperationalStatus(
            { sessionId: "new-session", status: "ABIERTA" },
            [{ sessionId: "old-session", closed: true }],
            "old-session",
        ),
        "CERRADA",
    );
    assert.throws(
        () => resolveCashSessionOperationalStatus(null, [], "missing-session"),
        { message: "TPV_SESSION_NOT_FOUND" },
    );
});

test("TPV movement projection failure preserves the append-only persistence evidence", () => {
    const cause = new Error("CajaActual update failed");
    const error = createPersistedTpvProjectionError(cause, {
        recordId: "ledger-row-1",
        idempotencyKey: "movement-key-1",
    });
    assert.equal(error.code, "TPV_EVENT_PERSISTED_PROJECTION_UNCONFIRMED");
    assert.equal(error.persisted, true);
    assert.equal(error.projectionConfirmed, false);
    assert.equal(error.projectionStatus, "UNCONFIRMED");
    assert.equal(error.recordId, "ledger-row-1");
    assert.equal(error.idempotencyKey, "movement-key-1");
    assert.equal(error.cause, cause);
});

test("TPV movement failure reports persisted=true when repository confirms the ledger write", () => {
    const error = createPersistedTpvProjectionError(new Error("projection unavailable"), {
        recordId: "ledger-row-2",
        idempotencyKey: "movement-key-2",
    });
    const result = buildCashMovementFailure(error, false, "trace-1");
    assert.equal(result.status, "ERROR");
    assert.equal(result.persisted, true);
    assert.equal(result.isSynthetic, undefined);
    assert.equal(result.realPayment, undefined);
    assert.equal(result.recoverable, true);
    assert.equal(result.projectionStatus, "UNCONFIRMED");
    assert.equal(result.movementId, "ledger-row-2");
    assert.equal(result.traceId, "trace-1");
});

test("TPV movement failure preserves the pre-existing persisted flag", () => {
    const result = buildCashMovementFailure(new Error("audit failed"), true, "trace-2");
    assert.equal(result.persisted, true);
    assert.equal(result.recoverable, true);
});

test("TPV production modules use the shared movement response contracts", async () => {
    const [movements, repository] = await Promise.all([
        readFile(new URL("../tpv/tpvMovimientos.web.js", import.meta.url), "utf8"),
        readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8"),
    ]);
    assert.match(movements, /buildCashMovementSuccessData/);
    assert.match(movements, /session: activeSession/);
    assert.match(movements, /resolveCashSessionOperationalStatus/);
    assert.match(movements, /operationalStatus,/);
    assert.match(movements, /return buildCashMovementFailure\(error, persisted, traceId\)/);
    assert.match(repository, /createPersistedTpvProjectionError/);
    assert.equal((repository.match(/await _projectPersistedTpvEvent\(/g) || []).length, 3,
        "new, existing and duplicate-winner events must preserve projection failure metadata");
});
