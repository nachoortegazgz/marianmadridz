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
    TPV_COLLECTIONS,
    TPV_LEDGER_SOURCE,
    TPV_RUNTIME_POLICY,
    SDK_CONFIG,
    CONTROL_TYPE,
    OPERATIONAL_COLLECTIONS,
} from "../internalConfig.js";
import {
    normalizeClientIdempotencyKey,
    normalizeIdempotencyKey,
    normalizePaymentMethod,
    toMinorUnits,
    fromMinorUnits,
    makeTpvPayload,
    makeTpvRefundLockId,
    makeTpvSessionLockId,
    makeTpvTransactionId,
    makeTpvId,
    assertTpvCajaIntegrity,

} from "../tpv/tpvUtils.js";

test("TPV runtime policy uses the same contract independent of environment labels", async () => {
    const source = await readFile(new URL("../internalConfig.js", import.meta.url), "utf8");
    assert.equal(TPV_RUNTIME_POLICY.SOURCE_TYPE, "TPV");
    assert.equal(TPV_RUNTIME_POLICY.LEDGER_VERSION, "TPV_LEDGER_V3");
    assert.equal(TPV_RUNTIME_POLICY.SCHEMA_VERSION, 3);
    assert.equal(SDK_CONFIG.CURRENCY_CODE, "EUR");
    assert.equal(SDK_CONFIG.TZ, "Europe/Madrid");
    assert.equal(TPV_RUNTIME_POLICY.CURRENCY, undefined);
    assert.equal(TPV_RUNTIME_POLICY.CURRENCY_CODE, undefined);
    assert.equal(TPV_RUNTIME_POLICY.TIME_ZONE, undefined);
    assert.equal(TPV_RUNTIME_POLICY.ALLOW_REAL_PAYMENTS, undefined);
    assert.equal(TPV_RUNTIME_POLICY.ALLOW_NATIVE_WRITES, undefined);
    assert.equal(TPV_RUNTIME_POLICY.CAPABILITIES, undefined);
    assert.doesNotMatch(source, /TPV_RUNTIME_POLICY[\\s\\S]*?ALLOW_REAL_PAYMENTS|TPV_RUNTIME_POLICY[\\s\\S]*?ALLOW_NATIVE_WRITES/);
});

test("CajaActual integrity accepts only the neutral v3 contract", () => {
    const bootstrap = {
        cashRegisterStatus: "CERRADA",
        snapshotSource: TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE,
        conceptOperations: { tpvRuntime: {
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
            schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        } },
    };
    assert.doesNotThrow(() => assertTpvCajaIntegrity(bootstrap, { allowBootstrap: true }));

    const activeCaja = {
        cashRegisterStatus: "ABIERTA",
        snapshotSource: TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE,
        traceId: "TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":SESSION-NEUTRAL",
        conceptOperations: { tpvRuntime: {
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
            schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
            sessionId: "SESSION-NEUTRAL",
            eventHash: "a".repeat(64),
        } },
    };
    assert.doesNotThrow(() => assertTpvCajaIntegrity(activeCaja));

    const sameContractCaja = {
        ...activeCaja,
        cashRegisterStatus: "CERRADA",
        conceptOperations: { tpvRuntime: {
            ...activeCaja.conceptOperations.tpvRuntime,
            sessionId: "SESSION-CLOSED",
        } },
    };
    assert.doesNotThrow(() => assertTpvCajaIntegrity(sameContractCaja));
});

test("CajaActual operational projections use neutral metadata and ignore historical fields", async () => {
    const [repository, utilities] = await Promise.all([
        readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8"),
        readFile(new URL("../tpv/tpvUtils.js", import.meta.url), "utf8"),
    ]);
    assert.match(repository, /conceptOperations\.tpvRuntime = sourceState/);
    assert.match(repository, /tpvRuntime: \{/);
    assert.match(repository, /TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.doesNotMatch(repository, /processingMode:|reconciliationStatus:|allowNativePayments:|allowNativeRefunds:/);
    assert.match(utilities, /export function getTpvRuntimeState\(caja\)/);
    assert.match(utilities, /caja\?\.conceptOperations\?\.tpvRuntime/);
    assert.doesNotMatch(utilities, /tpvSandbox/);
    assert.match(repository, /_isTpvLedgerItem/);
    assert.doesNotMatch(repository, /_isHistoricalTpvLedgerItem/);
});

test("logical TPV entities cannot be newly persisted until the canonical ledger is implemented", () => {
    const logicalTypes = Object.values(TPV_COLLECTIONS);
    assert.equal(new Set(logicalTypes).size, logicalTypes.length);
    assert.ok(logicalTypes.every((value) => value.startsWith("TPV_LOGICAL_")));

    const item = {
        _id: "TPV_TEST_ROW",
        hash: "a".repeat(64),
        sequenceNumber: 1,
        transactionId: "TPV_TEST_ROW",
        traceId: "TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":SESSION-TEST",
        movementType: "TPV_PAYMENT",
        recordSource: TPV_LEDGER_SOURCE,
        payloadFiscal: {
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
            schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
            sessionId: "SESSION-TEST",
            logicalCollection: TPV_COLLECTIONS.PAGOS,
            idempotencyKey: "TPV-TEST-IDEMPOTENCY",
            requestFingerprint: "f".repeat(64),
        },
    };

    assert.doesNotThrow(() => assertInsertAllowed("MovimientosCaja", item));
    assert.throws(() => assertUpdateAllowed("MovimientosCaja", item), { code: "LEDGER_APPEND_ONLY" });
    assert.throws(() => assertRemoveAllowed("MovimientosCaja", item._id, undefined, item), { code: "LEDGER_APPEND_ONLY" });
    assert.throws(() => assertRemoveAllowed("MovimientosCaja", "ledger-row"), { code: "LEDGER_APPEND_ONLY" });

    for (const logicalType of logicalTypes) {
        assert.throws(() => assertInsertAllowed(logicalType, item), /DATA_ACCESS_ERROR/);
    }
});

test("TPV refund lock allows only scoped compare-and-swap fields", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: "TPVQaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        controlType: CONTROL_TYPE.TPV_REFUND_LOCK,
        dedupeKey: "TPV_REFUND:TPV-SALE-TEST",
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { sourceType: "TPV", siteId: TPV_RUNTIME_POLICY.SITE_ID },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { sourceType: "TPV", siteId: TPV_RUNTIME_POLICY.SITE_ID } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payloadJson", action: "SET_FIELD", value: "{}" },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }), /DATA_ACCESS_ERROR/);
});

test("refund lock IDs are deterministic and respect Wix CMS _id length", () => {
    const saleId = "SALE-" + "x".repeat(100);
    const first = makeTpvRefundLockId(saleId);
    assert.equal(first, makeTpvRefundLockId(saleId));
    assert.equal(first.length, 36);
    assert.match(first, /^TPVQ[a-f0-9]{32}$/);
});

test("refund lock is mutable only through its scoped compare-and-swap policy", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: "TPVQaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        controlType: CONTROL_TYPE.TPV_REFUND_LOCK,
        dedupeKey: "TPV_REFUND:TPV-SALE-TEST",
        traceId: "test",
        version: 0,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(
        collection,
        "TPVQaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        CONTROL_TYPE.TPV_REFUND_LOCK
    ), { code: "CMS_DELETE_PROHIBITED" });
});

test("TPV session lock is deterministic, bounded and CAS-only", () => {
    const sessionId = "SESSION-20261116";
    const lockId = makeTpvSessionLockId(sessionId);
    assert.equal(lockId, makeTpvSessionLockId(sessionId));
    assert.equal(lockId.length, 36);
    assert.match(lockId, /^TPVS[a-f0-9]{32}$/);

    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_SESSION_LOCK,
        dedupeKey: "TPV_SESSION:" + lockId.slice(4),
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { sessionId, sourceType: "TPV", siteId: TPV_RUNTIME_POLICY.SITE_ID },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { sessionId, sourceType: "TPV", siteId: TPV_RUNTIME_POLICY.SITE_ID } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_SESSION_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_SESSION_LOCK,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(collection, lockId, CONTROL_TYPE.TPV_SESSION_LOCK), { code: "CMS_DELETE_PROHIBITED" });
});

test("MovimientosCaja transaction IDs are unique across logical TPV event collections", () => {
    const key = "arqueo-reintento-0001";
    const cashCountId = makeTpvTransactionId(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, key);
    const ticketId = makeTpvTransactionId(TPV_COLLECTIONS.TICKET_Z, key);
    const auditId = makeTpvTransactionId(TPV_COLLECTIONS.AUDITORIA, key);

    assert.match(cashCountId, /^TPV_[a-f0-9]{64}$/);
    assert.match(makeTpvId("SALE", key), /^TPV-SALE-/);
    assert.notEqual(cashCountId, ticketId);
    assert.notEqual(cashCountId, auditId);
    assert.notEqual(ticketId, auditId);
    assert.equal(cashCountId, makeTpvTransactionId(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, key));
});

test("operational idempotency never derives identifiers from environment labels", async () => {
    const repository = await readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8");
    const utilities = await readFile(new URL("../tpv/tpvUtils.js", import.meta.url), "utf8");
    assert.match(repository, /_isTpvLedgerItem/);
    assert.doesNotMatch(utilities, /makeLegacyTpvTransactionId|TPVSANDBOX/);
});

test("TPV runtime uses a neutral contract and client idempotency keys are bounded", () => {
    assert.equal(TPV_RUNTIME_POLICY.SOURCE_TYPE, "TPV");
    assert.equal(SDK_CONFIG.CURRENCY_CODE, "EUR");
    assert.equal(SDK_CONFIG.TZ, "Europe/Madrid");
    assert.match(TPV_RUNTIME_POLICY.SITE_ID, /^[0-9a-f-]{36}$/i);
    assert.equal(TPV_RUNTIME_POLICY.LEDGER_VERSION, "TPV_LEDGER_V3");
    assert.equal(TPV_RUNTIME_POLICY.SCHEMA_VERSION, 3);
    assert.equal(TPV_RUNTIME_POLICY.ALLOW_REAL_PAYMENTS, undefined);
    assert.equal(TPV_RUNTIME_POLICY.ALLOW_NATIVE_WRITES, undefined);
    assert.equal(TPV_RUNTIME_POLICY.CAPABILITIES, undefined);
    assert.equal(normalizeClientIdempotencyKey("client-key-tpv-0001"), "client-key-tpv-0001");
    assert.throws(() => normalizeClientIdempotencyKey("short"), /TPV_IDEMPOTENCY_KEY_INVALID/);
    assert.equal(normalizeIdempotencyKey("client-key-tpv-0001:PAYMENT:001"), "client-key-tpv-0001:PAYMENT:001");
    assert.equal(normalizePaymentMethod("bizum"), "BIZUM");
    assert.equal(toMinorUnits(12.34), 1234);
    assert.equal(toMinorUnits("12,34"), 1234);
    assert.equal(toMinorUnits("1.234,56"), 123456);
    assert.equal(toMinorUnits("1,234.56"), 123456);
    assert.equal(toMinorUnits(" 12,5 € "), 1250);
    assert.equal(fromMinorUnits(1234), 12.34);
    assert.throws(() => toMinorUnits(12.345), /TPV_INVALID_PRECISION/);
    assert.throws(() => toMinorUnits(Number.MAX_VALUE), /TPV_MINOR_UNITS_OUT_OF_RANGE/);
    assert.throws(() => toMinorUnits("90071992547410.00"), /TPV_MINOR_UNITS_OUT_OF_RANGE/);
    assert.throws(() => toMinorUnits("1.234"), /TPV_INVALID_FORMAT/);
    assert.throws(() => toMinorUnits("12,345"), /TPV_INVALID_FORMAT/);
    const payload = makeTpvPayload({ concept: "Servicio [SINTÉTICO]" });
    assert.equal(payload.sourceType, "TPV");
    assert.equal(payload.siteId, TPV_RUNTIME_POLICY.SITE_ID);
    assert.equal(payload.ledgerVersion, "TPV_LEDGER_V3");
    assert.equal(payload.schemaVersion, 3);
    assert.equal(payload.isSynthetic, undefined);
    assert.equal(payload.realPayment, undefined);
    assert.equal(payload.processingMode, undefined);
    assert.equal(payload.reconciliationStatus, undefined);
    assert.equal(payload.allowNativePayments, undefined);
    assert.equal(payload.allowNativeRefunds, undefined);

    const neutralPayload = makeTpvPayload({ isSynthetic: true, realPayment: false, processingMode: "SIMULATION" });
    assert.equal(neutralPayload.isSynthetic, undefined);
    assert.equal(neutralPayload.realPayment, undefined);
    assert.equal(neutralPayload.processingMode, undefined);
    for (const field of ["sourceType", "ledgerVersion", "schemaVersion", "recordSource"]) {
        assert.throws(() => makeTpvPayload({ [field]: "client-value" }), /TPV_BACKEND_METADATA_FORBIDDEN/);
    }
    assert.throws(() => makeTpvPayload(null), /TPV_INVALID_PAYLOAD/);
    assert.throws(() => makeTpvPayload([]), /TPV_INVALID_PAYLOAD/);
});


// TODO(#416): Add registrarVenta idempotency, product-not-found and Draft Order integration tests when the test environment is available.
 // Local verification was blocked: git clone could not resolve github.com (DNS); npm view @wix/ecom@1.0.2539 timed out.
test("every exposed TPV WebMethod checks backend role authorization before repository access", async () => {
    const protectedMethods = [
        ["tpvCaja.web.js", ["inicializarCaja", "obtenerEstadoCaja", "abrirSesionCaja", "registrarArqueoParcial", "cerrarSesionCaja"]],
        ["tpvMovimientos.web.js", ["registrarMovimientoCaja", "obtenerMovimientosCaja"]],
        ["tpvVentas.web.js", ["registrarVenta"]],
        ["tpvDevoluciones.web.js", ["registrarDevolucion"]],
        ["tpvCierres.web.js", ["obtenerResumenCaja", "generarTicketX", "generarCierreZ"]],
        ["tpvExport.web.js", ["exportarMovimientos"]],
        ["tpvPagos.web.js", ["validarDesglosePagos"]],
        ["tpvUtils.web.js", ["obtenerConfiguracionTPV"]],
        ["tpvPermisos.web.js", ["obtenerPermisosTPV"]],
        ["tpvAuditoria.web.js", ["obtenerAuditoriaTPV"]],
        ["tpvGiftCards.web.js", ["consultarTarjetaRegalo"]],
    ];
    const repositoryAccess = /(?:latestOpenTpvSession|insertTpvEvent|appendTpvAudit|queryTpvRecords|queryTpvLedgerRecords|queryTpvOperationalLedgerRecords|queryHistoricalTpvLedgerRecords|withTpvSessionLock|withTpvSaleLock|listTpvIdentities|getTpvIdentity|wql\.)/;

    for (const [fileName, methodNames] of protectedMethods) {
        const source = await readFile(new URL("../tpv/" + fileName, import.meta.url), "utf8");
        assert.match(source, /require(?:Admin|Cajero)|getMyCajeroContext/, fileName + " must retain backend role authorization");
        for (const methodName of methodNames) {
            const declaration = "export const " + methodName + " = webMethod(";
            const start = source.indexOf(declaration);
            assert.notEqual(start, -1, fileName + " must expose " + methodName);
            const nextExport = source.indexOf("\nexport const ", start + declaration.length);
            const block = source.slice(start, nextExport < 0 ? source.length : nextExport);
            const authorization = block.search(/await require(?:Admin|Cajero)\(|await getMyCajeroContext\(/);
            assert.notEqual(authorization, -1, methodName + " must authorize on the server");
            const access = block.search(repositoryAccess);
            assert.ok(access < 0 || authorization < access, methodName + " must authorize before repository access");
        }
    }
});


test("every exported TPV WebMethod has an explicit runtime policy classification", async () => {
    const policies = {
        "tpvCaja.web.js": {
            guarded: ["inicializarCaja", "obtenerEstadoCaja", "abrirSesionCaja", "registrarArqueoParcial", "cerrarSesionCaja"],
        },
        "tpvMovimientos.web.js": {
            guarded: ["registrarMovimientoCaja", "exportarMovimientosCaja", "exportarAuditoriaTPV"],
            readOnly: ["obtenerMovimientosCaja"],
        },
        "tpvVentas.web.js": {
            guarded: ["registrarVenta"],
            readOnly: ["validarVentaBorrador"],
        },
        "tpvDevoluciones.web.js": {
            guarded: ["registrarDevolucion"],
        },
        "tpvCierres.web.js": {
            guarded: ["obtenerResumenCaja", "generarTicketX", "generarCierreZ"],
        },
        "tpvPagos.web.js": {
            guarded: ["validarDesglosePagos"],
        },
        "tpvUtils.web.js": {
            guarded: ["obtenerConfiguracionTPV"],
        },
        "tpvExport.web.js": {
            guarded: ["exportarMovimientos"],
        },
        "tpvPermisos.web.js": {
            guarded: ["obtenerPermisosTPV"],
        },
        "tpvAuditoria.web.js": {
            guarded: ["obtenerAuditoriaTPV"],
        },
        "tpvGiftCards.web.js": {
            guarded: ["consultarTarjetaRegalo"],
        },
        "tpvCatalogo.web.js": {
            readOnly: [
                "buscarClientesTPV",
                "obtenerReservasClienteTPV",
                "obtenerServicios",
                "obtenerStaff",
                "obtenerProductos",
                "obtenerVariantesProducto",
            ],
        },
    };
    const writeOperations = /(?:insertItem|updateItem|saveItem|removeItem|bulkPatchItems|bulkRemoveItems|insertTpvEvent|appendTpvAudit|registerManualTransaction|\.insert\(|\.update\(|\.remove\(|\.bulkPatch\()/;

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
            const authorization = block.search(/await require(?:Admin|Cajero)\(|await getMyCajeroContext\(/);
            assert.notEqual(authorization, -1, methodName + " must authorize on the backend");
            const firstWrite = block.search(writeOperations);
            assert.ok(firstWrite < 0 || authorization < firstWrite, methodName + " must authorize before writes");
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
    const boundary = start + declaration.length;
    const candidates = [
        source.indexOf("\nexport const ", boundary),
        source.indexOf("\nasync function ", boundary),
        source.indexOf("\nfunction ", boundary),
    ].filter((index) => index >= 0);
    return source.slice(start, candidates.length ? Math.min(...candidates) : source.length);
}


test("TPV bootstrap no longer depends on the deleted identity collection", async () => {
    const repository = await readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8");
    const caja = await readFile(new URL("../tpv/tpvCaja.web.js", import.meta.url), "utf8");
    assert.doesNotMatch(repository, /seedTpvIdentities|listTpvIdentities|TPV_IDENTITIES_NOT_PRESEEDED/);
    assert.doesNotMatch(caja, /seedTpvIdentities|identitiesCreated|identitiesTotal/);
    const initializeStart = repository.indexOf("export async function initializeTpvCaja(");
    const getCajaStart = repository.indexOf("async function _getCajaActual", initializeStart);
    assert.notEqual(initializeStart, -1);
    assert.notEqual(getCajaStart, -1);
    const initializeBlock = repository.slice(initializeStart, getCajaStart);
    assert.match(initializeBlock, /if \(!existing\) throw new Error\("TPV_CASH_REGISTER_NOT_PRESEEDED"\)/);
    assert.doesNotMatch(initializeBlock, /insertItem\(|authorizeCreate/);

    const insertStart = repository.indexOf("export async function insertTpvEvent(");
    const insertEnd = repository.indexOf("export async function queryTpvRecords", insertStart);
    assert.notEqual(insertStart, -1);
    assert.notEqual(insertEnd, -1);
    const insertBlock = repository.slice(insertStart, insertEnd);
    assert.match(insertBlock, /const caja = await _getCajaActual\(\);\s*assertTpvCajaIntegrity\(caja\);/);
    assert.ok(insertBlock.indexOf("assertTpvCajaIntegrity(caja)") < insertBlock.indexOf("await insertItem("));
});


test("TPV locks preserve CajaActual integrity; only session opening can supersede the known legacy projection", async () => {
    const repository = await readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8");
    const helperStart = repository.indexOf("async function _ensureCajaActual(");
    const helperEnd = repository.indexOf("\n}\n", helperStart) + 2;
    const lockStart = repository.indexOf("async function withTpvScopedLock(");
    const lockEnd = repository.indexOf("\nexport async function withTpvSaleLock", lockStart);
    const sessionLockStart = repository.indexOf("export async function withTpvSessionLock(");
    const sessionLockEnd = repository.indexOf("\nconst VOLATILE_FIELDS", sessionLockStart);
    const guardStart = repository.indexOf("function _assertTpvCajaLockable(");
    const guardEnd = repository.indexOf("\nfunction _isLegacyUnverifiedProjection", guardStart);
    assert.notEqual(helperStart, -1);
    assert.notEqual(helperEnd, -1);
    assert.notEqual(lockStart, -1);
    assert.notEqual(lockEnd, -1);
    assert.notEqual(sessionLockStart, -1);
    assert.notEqual(sessionLockEnd, -1);
    assert.notEqual(guardStart, -1);
    assert.notEqual(guardEnd, -1);

    const helper = repository.slice(helperStart, helperEnd);
    assert.match(helper, /const caja = await _getCajaActual\(\)/);
    assert.match(helper, /TPV_CASH_REGISTER_NOT_SEEDED/);
    assert.match(helper, /assertTpvCajaIntegrity\(caja, \{ allowBootstrap: true \}\)/);

    const lock = repository.slice(lockStart, lockEnd);
    const preflight = lock.indexOf("_assertTpvCajaLockable(caja, allowLegacyProjection)");
    const firstControlAccess = Math.min(
        ...["getItem(", "insertItem(", "bulkPatchItems("].map((token) => {
            const index = lock.indexOf(token);
            return index < 0 ? Number.POSITIVE_INFINITY : index;
        })
    );
    assert.notEqual(preflight, -1);
    assert.ok(preflight < firstControlAccess, "CajaActual must be validated before ControlOperativo lock access");
    assert.match(lock, /allowLegacyProjection = false/);

    const sessionLock = repository.slice(sessionLockStart, sessionLockEnd);
    assert.match(sessionLock, /allowLegacyProjection = false/);
    assert.match(sessionLock, /allowLegacyProjection,/);

    const guard = repository.slice(guardStart, guardEnd);
    assert.match(guard, /if \(allowLegacyProjection && _isLegacyUnverifiedProjection\(caja\)\) return true/);
    assert.match(guard, /assertTpvCajaIntegrity\(caja, \{ allowBootstrap: true \}\)/);
    const legacyStart = repository.indexOf("function _isLegacyUnverifiedProjection(");
    const legacyEnd = repository.indexOf("function _sessionFromCaja", legacyStart);
    const legacyProjection = repository.slice(legacyStart, legacyEnd);
    assert.ok(legacyStart >= 0 && legacyEnd > legacyStart);
    assert.doesNotMatch(legacyProjection, /SIMULATED_SUCCESS|SYNTHETIC|SANDBOX|QA/);
    assert.ok(legacyProjection.includes('cashRegisterStatus === "ABIERTA"'));
    assert.ok(legacyProjection.includes('snapshotSource === "MOVIMIENTOS_CAJA_RECONCILIADOS"'));
    assert.ok(legacyProjection.includes('String(caja?.traceId || "") === "0"'));
    assert.ok(legacyProjection.includes('!String(state?.sessionId || "").trim()'));
});
