import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../../", import.meta.url);

async function repoFile(path) {
    return readFile(new URL(path, repoRoot), "utf8");
}

test("cash opening writes an append-only APERTURA movement and returns its receipt", async () => {
    const source = await repoFile("src/backend/tpv/tpvCaja.web.js");
    const start = source.indexOf("export const abrirSesionCaja");
    const end = source.indexOf("export const registrarArqueoParcial", start);
    assert.ok(start >= 0 && end > start, "abrirSesionCaja is present");
    const method = source.slice(start, end);

    assert.match(method, /insertTpvEvent\(\s*TPV_COLLECTIONS\.MOVIMIENTOS_CAJA/);
    assert.match(method, /movementType:\s*"APERTURA"/);
    assert.match(method, /amountMinor:\s*openingCashMinor/);
    assert.match(method, /paymentMethod:\s*"EFECTIVO"/);
    assert.match(method, /openingReceipt:\s*\{/);
    assert.match(method, /ticketType:\s*"APERTURA_CAJA"/);
    assert.match(method, /openingMovement\.item\._id/);
    assert.match(method, /openingTransactionId:/);
});

test("APERTURA movement is reflected in CajaActual without adding the opening amount twice", async () => {
    const source = await repoFile("src/backend/tpv/tpvRepository.js");
    const start = source.indexOf("if (collection === TPV_COLLECTIONS.MOVIMIENTOS_CAJA)");
    const end = source.indexOf("if (collection === TPV_COLLECTIONS.TICKET_Z)", start);
    assert.ok(start >= 0 && end > start, "movement projection branch is present");
    const projection = source.slice(start, end);

    assert.match(projection, /type === "APERTURA"/);
    assert.match(projection, /next\.lastOperationType = "TPV_SESSION_OPEN"/);
    assert.match(projection, /next\.expectedCash = Number\(next\.cashAmount \|\| 0\)/);
    assert.doesNotMatch(projection, /type === "APERTURA"[\s\S]{0,250}next\.cashAmount\s*=.*\+/);
});

test("open-cash dialog displays the backend opening receipt and exposes print and continue actions", async () => {
    const widget = await repoFile("%23htmlTPV.txt");
    const start = widget.indexOf("function openingReceiptHtml");
    const end = widget.indexOf("/* ---------- Entrada / Salida de efectivo ---------- */", start);
    assert.ok(start >= 0 && end > start, "opening dialog implementation is present");
    const openingUi = widget.slice(start, end);

    assert.match(openingUi, /receipt\.professional/);
    assert.match(openingUi, /receipt\.operationDate/);
    assert.match(openingUi, /receipt\.openedAt/);
    assert.match(openingUi, /receipt\.total/);
    assert.match(openingUi, /receipt\.breakdown/);
    assert.match(openingUi, /id="printOpeningTicket"/);
    assert.match(openingUi, /Cerrar y continuar/);
    assert.match(openingUi, /opened\.openingReceipt/);
    assert.doesNotMatch(openingUi, /call\("TICKET_X"/);
});
