import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    assertBulkPatchAllowed,
    assertInsertAllowed,
    assertUpdateAllowed,
    assertRemoveAllowed,
} from "../dataAccessPolicy.js";
import {
    TPV_SANDBOX_COLLECTIONS,
    TPV_SANDBOX_RUNTIME_POLICY,
    CONTROL_TYPE,
    OPERATIONAL_COLLECTIONS,
} from "../internalConfig.js";
import {
    normalizeClientIdempotencyKey,
    normalizeIdempotencyKey,
    normalizePaymentMethod,
    toMinorUnits,
    fromMinorUnits,
    makeSyntheticPayload,
    makeSandboxRefundLockId,
    makeSandboxSessionLockId,
    assertSandboxCajaWritable,
    assertTpvSandboxEnabled,
} from "../tpv/tpvUtils.js";

test("Sandbox runtime is enabled for synthetic records only; fiscal and external side effects remain disabled", async () => {
    const source = await readFile(new URL("../internalConfig.js", import.meta.url), "utf8");
    assert.match(source, /TPV_SANDBOX_RUNTIME_POLICY = Object\.freeze\(\{[\s\S]*?ENABLED: true,[\s\S]*?ENVIRONMENT: "SANDBOX"/);
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.ENABLED, true, "offline loader enables the policy only inside tests");
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT, "SANDBOX");
    assert.doesNotThrow(() => assertTpvSandboxEnabled());
});

test("SANDBOX writes require an exact test-run CajaActual marker and never accept a live cash singleton", () => {
    const sandboxRunId = TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID;
    const liveCaja = {
        singletonKey: "CAJA_PRINCIPAL",
        cashRegisterStatus: "ABIERTA",
        snapshotSource: "APERTURA_CAJA",
        traceId: "",
        conceptOperations: {},
    };
    assert.throws(
        () => assertSandboxCajaWritable(liveCaja, { allowBootstrap: true }),
        /TPV_SANDBOX_CASH_REGISTER_NOT_IN_TEST_MODE/
    );

    const sandboxBootstrap = {
        cashRegisterStatus: "CERRADA",
        snapshotSource: "TPV_SANDBOX_INITIALIZED",
        traceId: sandboxRunId,
        conceptOperations: { tpvSandbox: { sandboxRunId } },
    };
    assert.throws(
        () => assertSandboxCajaWritable(sandboxBootstrap),
        /TPV_SANDBOX_CASH_REGISTER_NOT_IN_TEST_MODE/
    );
    assert.doesNotThrow(() => assertSandboxCajaWritable(sandboxBootstrap, { allowBootstrap: true }));

    const activeSandboxCaja = {
        cashRegisterStatus: "SIMULACION",
        snapshotSource: "TPV_SANDBOX_SYNTHETIC",
        traceId: sandboxRunId,
        conceptOperations: { tpvSandbox: { sandboxRunId } },
    };
    assert.doesNotThrow(() => assertSandboxCajaWritable(activeSandboxCaja));
    assert.throws(
        () => assertSandboxCajaWritable({ ...activeSandboxCaja, traceId: "OTHER_TEST_RUN" }),
        /TPV_SANDBOX_CASH_REGISTER_NOT_IN_TEST_MODE/
    );
});

test("logical TPV entities persist only as marked synthetic rows in canonical CMS", () => {
    const logicalTypes = Object.values(TPV_SANDBOX_COLLECTIONS);
    assert.equal(new Set(logicalTypes).size, logicalTypes.length);
    assert.ok(logicalTypes.every((value) => value.startsWith("SANDBOX_LOGICAL_")));

    const item = {
        _id: "TPVSANDBOX_TEST_ROW",
        hash: "a".repeat(64),
        sequenceNumber: 0,
        transactionId: "TPVSANDBOX_TEST_ROW",
        traceId: "TPVSANDBOX:" + TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID + ":SANDBOX-SESSION-TEST",
        movementType: "SIMULATED_TPV_PAYMENT",
        recordSource: "TPV_SANDBOX_SYNTHETIC",
        payloadFiscal: {
            sandboxRunId: TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID,
            logicalCollection: TPV_SANDBOX_COLLECTIONS.PAGOS,
            idempotencyKey: "TPVSANDBOX-TEST-IDEMPOTENCY",
            requestFingerprint: "f".repeat(64),
            isSynthetic: true,
            realPayment: false,
            externalSideEffects: false,
        },
    };

    assert.doesNotThrow(() => assertInsertAllowed("MovimientosCaja", item));
    assert.doesNotThrow(() => assertUpdateAllowed("MovimientosCaja", item));
    assert.doesNotThrow(() => assertRemoveAllowed("MovimientosCaja", item._id, undefined, item));
    assert.throws(() => assertUpdateAllowed("MovimientosCaja", {
        ...item,
        payloadFiscal: { ...item.payloadFiscal, sandboxRunId: "TPVSANDBOX-DEV-20990101-OTHER" },
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed("MovimientosCaja", "real-ledger-row"), /DATA_ACCESS_ERROR/);

    for (const logicalType of logicalTypes) {
        assert.throws(() => assertInsertAllowed(logicalType, item), /DATA_ACCESS_ERROR/);
    }
});

test("SANDBOX refund lock allows only scoped compare-and-swap fields", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: "TPVSANDBOX_REFUND_LOCK_SANDBOX-SALE-TEST",
        controlType: CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK,
        dedupeKey: "TPV_SANDBOX_REFUND:SANDBOX-SALE-TEST",
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { environment: "SANDBOX" },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { environment: "SANDBOX" } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payloadJson", action: "SET_FIELD", value: "{}" },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }), /DATA_ACCESS_ERROR/);
});

test("refund lock IDs are deterministic and respect Wix CMS _id length", () => {
    const saleId = "SANDBOX-SALE-" + "x".repeat(100);
    const first = makeSandboxRefundLockId(saleId);
    assert.equal(first, makeSandboxRefundLockId(saleId));
    assert.equal(first.length, 36);
    assert.match(first, /^TPVQ[a-f0-9]{32}$/);
});

test("refund lock is mutable only through its scoped compare-and-swap policy", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: "TPVSANDBOX_REFUND_LOCK_SANDBOX-SALE-TEST",
        controlType: CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK,
        dedupeKey: "TPV_SANDBOX_REFUND:SANDBOX-SALE-TEST",
        traceId: "test",
        version: 0,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(
        collection,
        "TPVSANDBOX_REFUND_LOCK_SANDBOX-SALE-TEST",
        CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK
    ), /DATA_ACCESS_ERROR/);
});

test("SANDBOX session lock is deterministic, bounded and CAS-only", () => {
    const sessionId = "SANDBOX-SESSION-20261116";
    const lockId = makeSandboxSessionLockId(sessionId);
    assert.equal(lockId, makeSandboxSessionLockId(sessionId));
    assert.equal(lockId.length, 36);
    assert.match(lockId, /^TPVS[a-f0-9]{32}$/);

    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_SANDBOX_SESSION_LOCK,
        dedupeKey: "TPV_SANDBOX_SESSION:" + lockId.slice(4),
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { sessionId, environment: "SANDBOX" },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { sessionId, environment: "SANDBOX" } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_SANDBOX_SESSION_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_SANDBOX_SESSION_LOCK,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(collection, lockId, CONTROL_TYPE.TPV_SANDBOX_SESSION_LOCK), /DATA_ACCESS_ERROR/);
});

test("SANDBOX policy remains synthetic and client idempotency keys are bounded", () => {
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.ENABLED, true, "offline test harness override");
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT, "SANDBOX");
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.SYNTHETIC_ONLY, true);
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED, false);
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.FISCAL_WRITES_ENABLED, false);
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED, false);
    assert.equal(TPV_SANDBOX_RUNTIME_POLICY.HARDWARE_ENABLED, false);
    assert.equal(normalizeClientIdempotencyKey("sandbox-client-key-0001"), "sandbox-client-key-0001");
    assert.throws(() => normalizeClientIdempotencyKey("short"), /TPV_SANDBOX_IDEMPOTENCY_KEY_INVALID/);
    assert.equal(normalizeIdempotencyKey("sandbox-client-key-0001:PAYMENT:001"), "sandbox-client-key-0001:PAYMENT:001");
    assert.equal(normalizePaymentMethod("bizum"), "BIZUM");
    assert.equal(toMinorUnits(12.34), 1234);
    assert.equal(fromMinorUnits(1234), 12.34);
    assert.throws(() => toMinorUnits(12.345), /TPV_SANDBOX_INVALID_PRECISION/);
    const payload = makeSyntheticPayload({ sample: true });
    assert.equal(payload.isSynthetic, true);
    assert.equal(payload.realPayment, false);
    assert.equal(payload.externalSideEffects, false);
});


test("every exposed TPV SANDBOX WebMethod fails closed before repository access", async () => {
    const protectedMethods = [
        ["tpvCaja.web.js", ["inicializarCaja", "obtenerSesionCaja", "abrirCaja", "registrarArqueoParcial"]],
        ["tpvMovimientos.web.js", ["registrarMovimientoCaja"]],
        ["tpvVentas.web.js", ["registrarVenta"]],
        ["tpvDevoluciones.web.js", ["solicitarDevolucion"]],
        ["tpvCierres.web.js", ["obtenerResumenSesion", "generarTicketX", "cerrarTicketZ"]],
        ["tpvPagos.web.js", ["validarDesglosePagos"]],
        ["tpvUtils.web.js", ["obtenerConfiguracionTPV"]],
        ["tpvPermisos.web.js", ["obtenerPermisosTPV"]],
        ["tpvAuditoria.web.js", ["consultarAuditoriaTPV"]],
        ["tpvGiftCards.web.js", ["consultarTarjetaRegalo"]],
    ];
    const repositoryAccess = /(?:latestOpenSandboxSession|insertSandboxEvent|appendSandboxAudit|querySandboxRecords|withSandboxSessionLock|withSandboxSaleLock|listTpvSandboxIdentities|getTpvSandboxIdentity|wql\.)/;

    for (const [fileName, methodNames] of protectedMethods) {
        const source = await readFile(new URL("../tpv/" + fileName, import.meta.url), "utf8");
        assert.match(source, /assertTpvSandboxEnabled/, fileName + " must import/use the canonical SANDBOX gate");
        for (const methodName of methodNames) {
            const declaration = "export const " + methodName + " = webMethod(";
            const start = source.indexOf(declaration);
            assert.notEqual(start, -1, fileName + " must expose " + methodName);
            const nextExport = source.indexOf("\nexport const ", start + declaration.length);
            const block = source.slice(start, nextExport < 0 ? source.length : nextExport);
            const guard = block.indexOf("assertTpvSandboxEnabled()");
            assert.notEqual(guard, -1, methodName + " must execute the server-side SANDBOX gate");
            const access = block.search(repositoryAccess);
            assert.ok(access < 0 || guard < access, methodName + " must gate before repository access");
        }
    }
});


test("every exported TPV WebMethod has an explicit runtime policy classification", async () => {
    const policies = {
        "tpvCaja.web.js": {
            guarded: ["inicializarCaja", "obtenerSesionCaja", "abrirCaja", "registrarArqueoParcial"],
        },
        "tpvMovimientos.web.js": {
            guarded: ["registrarMovimientoCaja"],
        },
        "tpvVentas.web.js": {
            guarded: ["registrarVenta"],
            readOnly: ["validarVentaBorrador"],
            disabled: {
                procesarDevolucion: "TPV_OPERATIONAL_REFUNDS_DISABLED",
            },
        },
        "tpvDevoluciones.web.js": {
            guarded: ["solicitarDevolucion"],
        },
        "tpvCierres.web.js": {
            guarded: ["obtenerResumenSesion", "generarTicketX", "cerrarTicketZ"],
        },
        "tpvPagos.web.js": {
            guarded: ["validarDesglosePagos"],
        },
        "tpvUtils.web.js": {
            guarded: ["obtenerConfiguracionTPV"],
        },
        "tpvPermisos.web.js": {
            guarded: ["obtenerPermisosTPV"],
        },
        "tpvAuditoria.web.js": {
            guarded: ["consultarAuditoriaTPV"],
        },
        "tpvGiftCards.web.js": {
            guarded: ["consultarTarjetaRegalo"],
        },
        "tpvCatalogo.web.js": {
            readOnly: [
                "buscarClientesTPV",
                "obtenerReservasClienteTPV",
                "obtenerServicios",
                "obtenerProfesionales",
                "obtenerProductos",
                "obtenerVariantesProducto",
            ],
        },
    };
    const writeOperations = /(?:insertItem|updateItem|saveItem|removeItem|bulkPatchItems|bulkRemoveItems|insertSandboxEvent|appendSandboxAudit|registerManualTransaction|\.insert\(|\.update\(|\.remove\(|\.bulkPatch\()/;

    for (const [fileName, policy] of Object.entries(policies)) {
        const source = await readFile(new URL("../tpv/" + fileName, import.meta.url), "utf8");
        const expected = [
            ...(policy.guarded || []),
            ...(policy.readOnly || []),
            ...Object.keys(policy.disabled || {}),
        ].sort();
        const exported = Array.from(source.matchAll(/^export const (\w+) = webMethod\(/gm), (match) => match[1]).sort();
        assert.deepEqual(exported, expected, fileName + " must classify every exported WebMethod exactly once");

        for (const methodName of policy.guarded || []) {
            const block = getWebMethodSource(source, methodName);
            const guard = block.indexOf("assertTpvSandboxEnabled()");
            assert.notEqual(guard, -1, methodName + " must use the backend SANDBOX gate");
            const firstWrite = block.search(writeOperations);
            assert.ok(firstWrite < 0 || guard < firstWrite, methodName + " must gate before writes");
        }

        for (const methodName of policy.readOnly || []) {
            const block = getWebMethodSource(source, methodName);
            assert.doesNotMatch(block, writeOperations, methodName + " is classified read-only and must not write");
        }

        for (const [methodName, errorCode] of Object.entries(policy.disabled || {})) {
            const block = getWebMethodSource(source, methodName);
            assert.ok(block.includes('disabledResult("' + errorCode + '")'), methodName + " must remain fail-closed");
            assert.doesNotMatch(block, writeOperations, methodName + " must not reach a writer");
        }
    }
});

function getWebMethodSource(source, methodName) {
    const declaration = "export const " + methodName + " = webMethod(";
    const start = source.indexOf(declaration);
    assert.notEqual(start, -1, "Missing WebMethod " + methodName);
    const nextExport = source.indexOf("\nexport const ", start + declaration.length);
    return source.slice(start, nextExport < 0 ? source.length : nextExport);
}


test("Sandbox bootstrap is read-only and requires pre-seeded Sandbox records", async () => {
    const repository = await readFile(new URL("../tpv/tpvSandboxRepository.js", import.meta.url), "utf8");
    const initializeStart = repository.indexOf("export async function initializeSandboxCaja(");
    const identitiesStart = repository.indexOf("export async function seedSandboxIdentities(");
    const getCajaStart = repository.indexOf("async function _getCajaActual", initializeStart);
    assert.notEqual(initializeStart, -1);
    assert.notEqual(identitiesStart, -1);
    assert.notEqual(getCajaStart, -1);
    const initializeBlock = repository.slice(initializeStart, getCajaStart);
    const identitiesBlock = repository.slice(identitiesStart, initializeStart);
    assert.match(initializeBlock, /if \(!existing\) throw new Error\("TPV_SANDBOX_CASH_REGISTER_NOT_PRESEEDED"\)/);
    assert.doesNotMatch(initializeBlock, /insertItem\(|authorizeCreate/);
    assert.match(identitiesBlock, /TPV_SANDBOX_IDENTITIES_NOT_PRESEEDED/);
    assert.doesNotMatch(identitiesBlock, /insertItem\(|authorizeCreate/);

    const insertStart = repository.indexOf("export async function insertSandboxEvent(");
    const insertEnd = repository.indexOf("export async function querySandboxRecords", insertStart);
    assert.notEqual(insertStart, -1);
    assert.notEqual(insertEnd, -1);
    const insertBlock = repository.slice(insertStart, insertEnd);
    assert.match(insertBlock, /const caja = await _getCajaActual\(\);\s*assertSandboxCajaWritable\(caja\);/);
    assert.ok(insertBlock.indexOf("assertSandboxCajaWritable(caja)") < insertBlock.indexOf("await insertItem("));
});


test("TPV locks validate the pre-seeded Sandbox CajaActual before accessing ControlOperativo", async () => {
    const repository = await readFile(new URL("../tpv/tpvSandboxRepository.js", import.meta.url), "utf8");
    const helperStart = repository.indexOf("async function _ensureCajaActualForSandbox(");
    const helperEnd = repository.indexOf("\n}\n", helperStart) + 2;
    const lockStart = repository.indexOf("async function withSandboxScopedLock(");
    const lockEnd = repository.indexOf("\nexport async function withSandboxSaleLock", lockStart);
    assert.notEqual(helperStart, -1);
    assert.notEqual(helperEnd, -1);
    assert.notEqual(lockStart, -1);
    assert.notEqual(lockEnd, -1);

    const helper = repository.slice(helperStart, helperEnd);
    assert.match(helper, /const caja = await _getCajaActual\(\)/);
    assert.match(helper, /TPV_SANDBOX_CASH_REGISTER_NOT_SEEDED/);
    assert.match(helper, /assertSandboxCajaWritable\(caja, \{ allowBootstrap: true \}\)/);

    const lock = repository.slice(lockStart, lockEnd);
    const preflight = lock.indexOf("await _ensureCajaActualForSandbox()");
    const firstControlAccess = Math.min(
        ...["getItem(", "insertItem(", "bulkPatchItems("].map((token) => {
            const index = lock.indexOf(token);
            return index < 0 ? Number.POSITIVE_INFINITY : index;
        })
    );
    assert.notEqual(preflight, -1);
    assert.ok(preflight < firstControlAccess, "CajaActual marker must be checked before ControlOperativo locks");
});
