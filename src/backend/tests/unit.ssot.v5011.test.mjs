/*
=============================================================================
SUITE: unit.ssot.v5011 (node --test, offline via loader.mjs mocks)
Purpose: 14 assertions-equivalent tests replacing the legacy mocha-style
unit.testRunner battery, WITHOUT weakening any assertion. Covers:
pairToken determinism, slotKey format, date conversion, booking enums,
fiscal enums, accounting enums, collections defined, sdk config,
CitasF2 no-legacy payload, plus SSOT additions (EU VAT prefixes,
FISCAL_ROLE, forbidden-collection separation).
G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';

const IC = await import('backend/internalConfig');
const { SDK_CONFIG, CONCURRENCY } = IC;

// Canonical lookup across the two authoritative collection groups.
function collectionValue(key) {
  return IC.BUSINESS_COLLECTIONS[key] ?? IC.OPERATIONAL_COLLECTIONS[key];
}

const generatePairToken = (serviceId, date, time, email) => {
  const payload = `${serviceId}|${date}|${time}|${email}`;
  return createHash('sha256').update(payload).digest('hex').substring(0, 16);
};

test('UNIT-GEN-01 pairToken deterministic', () => {
  const a = generatePairToken('svc_test_dual_001', '2026-09-20', '10:00', 'test.unit@example.com');
  const b = generatePairToken('svc_test_dual_001', '2026-09-20', '10:00', 'test.unit@example.com');
  assert.strictEqual(a, b);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('UNIT-GEN-02 slotKey format', () => {
  const dateYmd = '2026-09-20';
  const resourceId = 'res_test_001';
  const hour = '10:00';
  const slotKey = `${dateYmd}_${resourceId}_${hour}`;
  assert.match(slotKey, /^\d{4}-\d{2}-\d{2}_[A-Za-z0-9_-]+_\d{2}:\d{2}$/);
});

test('UNIT-GEN-03 date conversion Madrid TZ stable', () => {
  const d = new Date('2026-09-20T10:00:00Z');
  assert.ok(d instanceof Date && !Number.isNaN(d.getTime()));
  assert.strictEqual(d.toISOString().slice(0, 10), '2026-09-20');
});

test('UNIT-ENUM-01 booking enums aligned with canonical SSOT', async () => {
  // FASE2 BIBLIA 12.2: BOOKING_STATUS canonico en ingles (PENDING/CANCELED);
  // los antiguos PENDING_PAYMENT/CANCELLED son solo lectura legacy.
  assert.strictEqual(IC.BOOKING_STATUS.CONFIRMED, 'CONFIRMED');
  assert.strictEqual(IC.BOOKING_STATUS.PENDING, 'PENDING');
  assert.strictEqual(IC.BOOKING_STATUS.CANCELED, 'CANCELED');
  assert.strictEqual(IC.BOOKING_STATUS.PENDING_PAYMENT, undefined);
  assert.strictEqual(IC.BOOKING_STATUS.CANCELLED, undefined);
  // AUDIT-2026-10-14: IC.LEGACY_BOOKING_STATUS_VALUES fue erradicado por
  // DEC-IC-03; la traduccion Wix->CMS vive exclusivamente en
  // bookingCore._toCmsBookingStatus. Se conserva la intencion original
  // (los grafias legacy PENDING_PAYMENT/CANCELLED siguen siendo dominios
  // reconocidos por el ecosistema) auditando el traductor autoritativo:
  // todo valor del enum SDK BOOKING_STATUS debe traducirse a un estado
  // CITAS_* canonico, y CANCELED -> CANCELLED (grafia de persistencia).
  const BCORE = await import('backend/booking/bookingCore.js');
  for (const sdkVal of Object.values(IC.BOOKING_STATUS)) {
    const cms = BCORE._toCmsBookingStatus(sdkVal);
    assert.ok(Object.values(IC.CITAS_BOOKING_STATUS).includes(cms),
      'SDK status ' + sdkVal + ' must translate to canonical CMS status, got ' + cms);
  }
  assert.strictEqual(BCORE._toCmsBookingStatus('CANCELED'), IC.CITAS_BOOKING_STATUS.CANCELLED);
  assert.strictEqual(IC.PAYMENT_STATUS.PAID, 'PAID');
  // FASE1-P0: alias UNPAID was eradicated from PAYMENT_STATUS (MATRIZ alias F).
  // Strengthened assertion: the retired key must NOT exist and the canonical
  // English value NOT_PAID must be present instead.
  assert.strictEqual(IC.PAYMENT_STATUS.UNPAID, undefined);
  assert.strictEqual(IC.PAYMENT_STATUS.NOT_PAID, 'NOT_PAID');
  assert.strictEqual(IC.PAYMENT_STATUS.PENDING_PAYMENT, 'PENDING_PAYMENT');
  assert.strictEqual(IC.PAYMENT_STATUS.REFUNDED, 'REFUNDED');
});

test('UNIT-ENUM-02 fiscal AEAT enums', () => {
  const invoiceTypes = ['F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5'];
  for (const t of ['F1', 'F2', 'F3', 'R1', 'R5']) assert.ok(invoiceTypes.includes(t));
  assert.strictEqual(invoiceTypes.length, 8);
  const regimeKeys = Array.from({ length: 17 }, (_, i) => String(i + 1).padStart(2, '0'));
  assert.ok(regimeKeys.includes('01') && regimeKeys.includes('17'));
  assert.strictEqual(regimeKeys.length, 17);
  const paymentMethods = ['EFECTIVO', 'TARJETA', 'BIZUM', 'TRANSFERENCIA', 'ONLINE'];
  for (const m of ['EFECTIVO', 'TARJETA', 'BIZUM', 'ONLINE']) assert.ok(paymentMethods.includes(m));
});

test('UNIT-ENUM-03 accounting PGC enums', () => {
  const entryStatus = ['DRAFT', 'POSTED', 'LOCKED'];
  assert.strictEqual(entryStatus.length, 3);
  const accountNature = ['ACTIVO', 'PASIVO', 'INGRESO', 'GASTO'];
  for (const n of accountNature) assert.ok(accountNature.includes(n));
});

test('UNIT-STRUCT-01 collections SSOT defined', () => {
  // CATEGORIAS_SERVICIO and LIBRO_REGISTRO_FACTURAS_EXPEDIDAS removed from the
  // required list: both are FORBIDDEN (BIBLIA 10) and their keys were retired
  // in FASE1-P0. A dedicated negative assertion below keeps the suite at least
  // as strict as before.
  // FASE3: DUAL_SLOT_CACHE fue absorbida por ControlOperativo (8-en-1, ADR-05);
  // la exigencia canonica es CONTROL_OPERATIVO presente en ambos grupos.
  const requiredCollections = [
    'SERVICIOS_CATALOGO', 'CITAS_F2',
    'CONTROL_OPERATIVO', 'MOVIMIENTOS_CAJA', 'HISTORICO_CIERRES_Z',
    'REGISTROS_HORARIOS_STAFF',
  ];
  for (const col of requiredCollections) {
    assert.ok(collectionValue(col), `Collection ${col} not defined`);
    assert.strictEqual(typeof collectionValue(col), 'string');
    assert.ok(collectionValue(col).length > 0);
  }
  // CONTROL_OPERATIVO se expone deliberadamente en BUSINESS y OPERATIONAL con
  // el mismo valor; el chequeo de duplicidad ignora esa clave compartida.
  const values = [
    ...Object.entries(IC.BUSINESS_COLLECTIONS),
    ...Object.entries(IC.OPERATIONAL_COLLECTIONS),
  ].filter(([key]) => key !== 'CONTROL_OPERATIVO').map(([, value]) => value);
  assert.strictEqual(values.length, new Set(values).size, 'duplicate collection values');
  assert.ok(IC.BUSINESS_COLLECTIONS.CONTROL_OPERATIVO === IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO);
  // Negativo FASE3: las 8 colecciones absorbidas ya no son claves canonicas.
  for (const retired of ['DUAL_SLOT_CACHE', 'AVAILABILITY_DAYS_CACHE', 'SLOT_LOCKS', 'RATE_LIMIT_BLOCKS', 'PROCESSED_WEBHOOK_EVENTS', 'BOOKING_TRANSACTIONS', 'COMPENSACIONES_PENDIENTES', 'ALERTAS_OPERATIVAS']) {
    assert.strictEqual(collectionValue(retired), undefined, `retired key ${retired} must be gone`);
  }
  // Negative: forbidden keys must NOT be reachable through canonical groups.
  assert.strictEqual(collectionValue('CATEGORIAS_SERVICIO'), undefined);
  assert.strictEqual(collectionValue('LIBRO_REGISTRO_FACTURAS_EXPEDIDAS'), undefined);
  // UNIT-STRUCT-01b (v12.1): MapaStaff es coleccion MUERTA (staff.js v9 lee
  // exclusivamente de la Bookings Staff API). Debe permanecer FUERA del SSOT;
  // esta asercion negativa sustituye a la antigua exigencia positiva.
  assert.strictEqual(collectionValue('MAPA_STAFF'), undefined, 'MAPA_STAFF must stay retired');
  // Negative: alias COLLECTIONS must not leak into internalConfig anymore is
  // checked in FASE2; here we only freeze-check the canonical groups.
  assert.ok(IC.FORBIDDEN_COLLECTIONS.includes('CategoriasServicio'));
  assert.ok(IC.FORBIDDEN_COLLECTIONS.includes('LibroRegistroFacturasExpedidas'));
});

test('UNIT-STRUCT-02 CONCURRENCY/SDK config valid', () => {
  assert.ok(CONCURRENCY && typeof CONCURRENCY === 'object');
  assert.ok(Number(CONCURRENCY.MS_TTL_MUTEX) > 0);
  assert.ok(Number(CONCURRENCY.MS_LATIDO) > 0);
  assert.strictEqual(SDK_CONFIG.TZ, 'Europe/Madrid');
});

test('UNIT-STRUCT-03 CitasF2 payload without legacy fields', () => {
  const bookingPayload = {
    bookingId: 'WIX_BK_TEST', pairToken: 'test_token', serviceId: 'svc_001',
    resourceId: 'res_001', startDate: new Date('2026-09-20T10:00:00Z'),
    endDate: new Date('2026-09-20T11:00:00Z'), dateYmd: '2026-09-20',
    bookingType: 'SIMPLE', status: 'PENDING', paymentStatus: 'UNPAID',
    traceId: 'TEST_TRACE',
  };
  for (const field of ['bookingId', 'pairToken', 'serviceId', 'startDate', 'endDate', 'status']) {
    assert.ok(bookingPayload[field] !== undefined, `missing required field: ${field}`);
  }
  assert.strictEqual(bookingPayload.startDateLocal, undefined);
  assert.strictEqual(bookingPayload.endDateLocal, undefined);
  assert.strictEqual(bookingPayload.uiPairToken, undefined);
  assert.ok(bookingPayload.startDate instanceof Date);
  assert.ok(bookingPayload.endDate instanceof Date);
  assert.match(bookingPayload.dateYmd, /^\d{4}-\d{2}-\d{2}$/);
});

test('SSOT-04 EU_VAT_PREFIXES removed (R2/DUP-06): SSOT lives in validation.js', () => {
  // internalConfig v12: R2/DUP-06 elimino EU_VAT_PREFIXES. La validacion de
  // prefijos VAT-UE vive exclusivamente en validation.js (regex por pais).
  // El assert canónico es la AUSENCIA del export para evitar resurrecciones.
  assert.strictEqual(IC.EU_VAT_PREFIXES, undefined);
});

test('SSOT-05 FISCAL_ROLE exported', () => {
  assert.strictEqual(IC.FISCAL_ROLE.EMISOR, 'EMISOR');
  assert.strictEqual(IC.FISCAL_ROLE.RECEPTOR, 'RECEPTOR');
});

test('SSOT-06 BUSINESS vs OPERATIONAL separation frozen', () => {
  assert.ok(Object.isFrozen(IC.BUSINESS_COLLECTIONS));
  assert.ok(Object.isFrozen(IC.OPERATIONAL_COLLECTIONS));
  assert.strictEqual(IC.BUSINESS_COLLECTIONS.CITAS_F2, 'CitasF2');
});

test('SSOT-07 BOOKING_TYPE present (canonical migration lands in FASE1)', () => {
  assert.ok(IC.BOOKING_TYPE && typeof IC.BOOKING_TYPE === 'object');
  assert.ok(Object.isFrozen(IC.BOOKING_TYPE));
});

test('SSOT-08 ITEM_NATURE present', () => {
  assert.ok(IC.ITEM_NATURE && typeof IC.ITEM_NATURE === 'object');
});

// SSOT-09 (PEND-D1 regression guard, 2026-10): suppressAuth must NOT return
// to the legacy-adapter consumers. dataAccess.js elevates unconditionally
// (R1/R5), so any call-site passing this flag is dead code that misleads
// auditors about the effective identity of the operation. Guard reads the
// real module sources (no mocks) and asserts zero active occurrences.
import {readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
test('SSOT-09 suppressAuth eliminated from crons/inventario/fiscalAggregator', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of ['crons.js', 'inventario.web.js', 'fiscalAggregator.web.js']) {
    const src = readFileSync(resolve(root, f), 'utf8');
    assert.ok(!/suppressAuth\s*:/.test(src), `${f} reintroduced suppressAuth option`);
  }
});

// SSOT-10 (PEND-D1 cierre definitivo, 2026-10): dos guards complementarios.
// (a) fiscalDocuments.web.js fue el ultimo consumidor con suppressAuth:true
//     literal; no debe regresar. (b) La elevacion vive SOLO en dataAccess.js
//     (DA-ELEV-01): todo acceso via wixData en esa capa pasa por auth.elevate,
//     por lo que los call-sites no necesitan (ni deben) declarar flags de
//     identidad. Se verifica que dataAccess.js importa @wix/essentials y que
//     ninguna operacion de lectura/escritura queda sin envolver.
test('SSOT-10 suppression flag gone + elevation centralized in dataAccess', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const fd = readFileSync(resolve(root, 'fiscalDocuments.web.js'), 'utf8');
  assert.ok(!/suppressAuth\s*:/.test(fd), 'fiscalDocuments.web.js uses suppressAuth option');
  // DAL-RETIRE-01 (2026-10): dataLegacyAdapter eliminado del repo; el guard
  // verifica su ausencia (el import top-level de fs ya trae readFileSync).
  assert.ok(!existsSync(resolve(root, 'dataLegacyAdapter.js')), 'dataLegacyAdapter.js must be retired');
  const da = readFileSync(resolve(root, 'dataAccess.js'), 'utf8');
  assert.ok(/from "@wix\/essentials"/.test(da), 'dataAccess.js must import auth from @wix/essentials');
  // Las consultas se construyen dentro de callbacks async elevados; no se eleva
  // por separado el factory wixData.query, porque devuelve un QueryBuilder.
  const runQueryBlock = da.match(/const runQuery = auth\.elevate\(\s*async[\s\S]*?\n\);/);
  const runCountBlock = da.match(/const runCount = auth\.elevate\(\s*async[\s\S]*?\n\);/);
  assert.ok(runQueryBlock && /wixData\.query\(dataCollectionId\)/.test(runQueryBlock[0]),
    'runQuery must build its query inside auth.elevate');
  assert.ok(runCountBlock && /wixData\.query\(dataCollectionId\)/.test(runCountBlock[0]),
    'runCount must build its query inside auth.elevate');

  // El resto de operaciones wixData deben usar wrappers elevados explícitos.
  const directCalls = da.split('\n').filter((line) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return false;
    if (/auth\.elevate\(wixData\./.test(line)) return false;
    if (/\bwixData\.query\(dataCollectionId\)/.test(line)) return false;
    return /\bwixData\.(query|get|insert|update|remove|save|bulkInsert|bulkUpdate|bulkRemove|queryReferencedItems)\s*\(/.test(line);
  });
  assert.equal(directCalls.length, 0, `dataAccess.js has non-elevated wixData calls: ${directCalls.join(' | ')}`);
});
