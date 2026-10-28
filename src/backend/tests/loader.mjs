/*
=============================================================================
MODULE: backend/tests/loader.mjs
PURPOSE: Offline test harness. Registers ESM loader hooks that mock every
"wix-*" module and map "backend/<name>" specifiers to src/backend/<name>.js,
so the real backend code can be imported and exercised with `node --test`
without a Wix Velo runtime and without node_modules.
SCOPE: tests only. Never imported by production code. G10 ASCII strict.
=============================================================================
*/

import { pathToFileURL } from 'node:url';
import { fileURLToPath, pathToFileURL as p2u } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/backend/tests -> src/backend
export const BACKEND_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Mock registry (mutable so tests can seed data / inspect calls)
// ---------------------------------------------------------------------------

/* LH-25c (harness, 2026-10-14): dataAccess.js DA-ELEV-01 captura
   auth.elevate(wixData.query) como referencia SUELTA del objeto literal.
   El SDK real de Wix conserva el binding correcto del namespace al
   desestructurar; en JS puro un metodo extraido pierde 'this'. Si los
   metodos del mock dependieran de 'this', la llamada elevaria TypeError
   ("Cannot read properties of undefined (reading '_calls')"). Se resuelve
   con selfbinding defensivo: cada query() se enlaza a si misma via bind,
   de modo que 'this' es SIEMPRE el singleton, sea invocada como metodo o
   como funcion suelta. */
const _selfBind = (obj) => {
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'function' && !k.startsWith('_')) obj[k] = obj[k].bind(obj);
  }
  return obj;
};

export const wixDataMock = _selfBind({
  _store: new Map(),          // collectionName -> array of items
  _calls: [],                 // audit trail of operations
  _findErrors: new Map(),      // test-only: collection -> forced find error
  _seed(collection, items) {
    // JSON round-trip would serialize Date instances to ISO strings and
    // break date comparisons in queries (.lt/_createdDate). Revive ISO
    // strings back into Date objects so seeded rows match live Velo types.
    const revived = JSON.parse(JSON.stringify(items), (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(value)) {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? value : d;
      }
      return value;
    });
    this._store.set(collection, revived);
  },
  _reset() {
    this._store.clear();
    this._calls.length = 0;
    this._findErrors.clear();
  },
  query(collection) {
    const rows = () => this._store.get(collection) || [];
    const state = { filters: [], limitN: 30, offsetN: 0 };
    // LH-14: wql.startsWith(field, value) produce {$startsWith:{field:value}}
    // (v2) o una forma field-centric segun SDK; el matcher v1 lo resuelve.
    const cmpValue = (v) => (v instanceof Date ? v.getTime() : v);
    // Real Velo semantics: filter methods (eq/in/lt...) return the same
    // WixDataQuery, so .eq(...).limit(1).count() chains legally. The mock
    // mirrors that by returning `q` from every builder method.
    // LH-16 (fix derivado de tests 2026-10-14, BCORE-PER-01/05): antes se
    // referenciaba `q` en q.filter ANTES de su declaracion (TDZ ReferenceError).
    // Se declara `q` primero y luego se enrichan los metodos.
    const q = {};
    q.filter = (clause) => { if (clause) state.filters.push(['wql', clause]); return q; };
    q.eq = (field, value) => { state.filters.push([field, value]); return q; };
    q.in = (field, values) => { state.filters.push([field, values]); return q; };
    q.ne = (field, value) => { state.filters.push(['!=', field, value]); return q; };
    q.lt = (field, value) => { state.filters.push(['<', field, value]); return q; };
    q.gt = (field, value) => { state.filters.push(['>', field, value]); return q; };
    q.le = (field, value) => { state.filters.push(['<=', field, value]); return q; };
    q.ge = (field, value) => { state.filters.push(['>=', field, value]); return q; };
    q.between = (field, low, high) => { state.filters.push(['range', field, low, high]); return q; };
    q.contains = (field, value) => { state.filters.push(['has', field, value]); return q; };
    q.hasSome = (field, values) => { state.filters.push(['some', field, values]); return q; };
    q.ascending = (...fields) => { state.sortAsc = fields; return q; };
    q.descending = (...fields) => { state.sortDesc = fields; return q; };
    q.limit = (n) => { state.limitN = n; return q; };
    q.skip = (n) => { state.offsetN = n; return q; };
    // LH-15 (fix derivado de tests 2026-10-14, BCORE-PER): bookingCore pasa
    // opciones por argumento ({ consistencyMode: 'strong' }) en vez de
    // encadenar .consistent(); el SDK real las acepta, el mock debe ignorarlas.
    const applyFilters = () => {
      let items = rows().slice();
      // LH-13: matcher MongoQL/v2 reutilizable para clausulas .filter(wql.*)
      const matchWql = (it, clause) => {
        if (!clause || typeof clause !== 'object') return true;
        return Object.entries(clause).every(([key, val]) => {
          if (key.startsWith('$')) {
            switch (key) {
              case '$and': return (val || []).every((c) => matchWql(it, c));
              case '$or': return (val || []).some((c) => matchWql(it, c));
              case '$eq': return Object.entries(val).every(([f, v]) => it[f] === v);
              case '$ne': return Object.entries(val).every(([f, v]) => it[f] !== v);
              case '$gt': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) > cmpValue(v));
              case '$gte': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) >= cmpValue(v));
              case '$lt': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) < cmpValue(v));
              case '$lte': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) <= cmpValue(v));
              case '$in': return Object.entries(val).every(([f, v]) => Array.isArray(v) && v.includes(it[f]));
              case '$hasSome': return Object.entries(val).every(([f, v]) => Array.isArray(it[f]) ? (v || []).some((x) => it[f].includes(x)) : Array.isArray(v) && v.includes(it[f]));
              case '$startsWith': return Object.entries(val).every(([f, v]) => String(it[f] ?? '').startsWith(String(v)));
              default: throw new Error('loader mock v1: operador wql no soportado ' + key);
            }
          }
          // Field-centric shorthand: { fieldName: { $op: value } } (forma
          // real de wixData.wql.eq(field,value) en Velo)
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            return Object.entries(val).every(([op, arg]) => {
              switch (op) {
                case '$eq': return it[key] === arg;
                case '$ne': return it[key] !== arg;
                case '$gt': return cmpValue(it[key]) > cmpValue(arg);
                case '$gte': return cmpValue(it[key]) >= cmpValue(arg);
                case '$lt': return cmpValue(it[key]) < cmpValue(arg);
                case '$lte': return cmpValue(it[key]) <= cmpValue(arg);
                case '$in': return Array.isArray(arg) && arg.includes(it[key]);
                case '$hasSome': return Array.isArray(it[key]) ? (arg || []).some((x) => it[key].includes(x)) : Array.isArray(arg) && arg.includes(it[key]);
                case '$startsWith': return String(it[key] ?? '').startsWith(String(arg));
                default: throw new Error('loader mock v1: operador wql no soportado ' + op);
              }
            });
          }
          return it[key] === val;
        });
      };
      for (const f of state.filters) {
        if (f[0] === 'wql') { items = items.filter((it) => matchWql(it, f[1])); }
        else if (f[0] === '!=') { items = items.filter((it) => it[f[1]] !== f[2]); }
        else if (f[0] === '<') { items = items.filter((it) => cmpValue(it[f[1]]) < cmpValue(f[2])); }
        else if (f[0] === '>') { items = items.filter((it) => cmpValue(it[f[1]]) > cmpValue(f[2])); }
        else if (f[0] === '<=') { items = items.filter((it) => cmpValue(it[f[1]]) <= cmpValue(f[2])); }
        else if (f[0] === '>=') { items = items.filter((it) => cmpValue(it[f[1]]) >= cmpValue(f[2])); }
        else if (f[0] === 'range') { items = items.filter((it) => cmpValue(it[f[1]]) >= cmpValue(f[2]) && cmpValue(it[f[1]]) <= cmpValue(f[3])); }
        else if (f[0] === 'has') { items = items.filter((it) => Array.isArray(it[f[1]]) && it[f[1]].includes(f[2])); }
        else if (f[0] === 'some') { items = items.filter((it) => Array.isArray(it[f[1]]) && it[f[1]].some((v) => f[2].includes(v))); }
        else if (Array.isArray(f[1])) { items = items.filter((it) => f[1].includes(it[f[0]])); }
        else { items = items.filter((it) => it[f[0]] === f[1]); }
      }
      return items;
    };
    // LH-12 (fix derivado de tests 2026-10-14, DA-SORT-02): el builder v1
    // ahora registra ascending/descending y find() debe ordenar igual que el
    // SDK real; antes se ignoraba y los tests de purga/ordenacion daban
    // falsos negativos.
    const applySort = (items) => {
      const cmp = (v) => (v instanceof Date ? v.getTime() : (v === undefined || v === null ? '' : v));
      if (state.sortDesc && state.sortDesc.length) {
        items.sort((a, b) => (cmp(a[state.sortDesc[0]]) < cmp(b[state.sortDesc[0]]) ? 1 : cmp(a[state.sortDesc[0]]) > cmp(b[state.sortDesc[0]]) ? -1 : 0));
      }
      if (state.sortAsc && state.sortAsc.length) {
        items.sort((a, b) => (cmp(a[state.sortAsc[0]]) > cmp(b[state.sortAsc[0]]) ? 1 : cmp(a[state.sortAsc[0]]) < cmp(b[state.sortAsc[0]]) ? -1 : 0));
      }
      return items;
    };
    q.count = async () => {
      this._calls.push({ op: 'query', collection });
      return applyFilters().length;
    };
    // LH-17 (fix derivado de tests E2E 2026-10-14): dataAccess.queryItems va
    // por la ruta v2 query(col).filter(wql.clause).ascending(...).limit().skip()
    // .find(opts). El builder v1 del mock NO tenia ascending/descending ni
    // totalCount, y ademas sliceaba con limitN=30 por defecto cuando el caller
    // no fijaba limite (SDK real: sin limite = todas las filas). Sin ascending
    // el .find de toda query via queryItems lanzaba TypeError -> LOOKUP/RESOLVE
    // devolvia DATABASE_ERROR. Se replican ahora las semanticas reales:
    //   - ascending/descending acumulativos (multi-campo, como WixDataQuery)
    //   - sort aplica PRIMERO por campo, luego ASC/DESC por campo (orden SDK)
    //   - find sin limite explicito devuelve TODAS las filas filtradas
    //   - totalCount = filas post-filtro pre-slice (semantica SDK v1)
    let limitExplicit = false;
    q.limit = ((orig) => (n) => { limitExplicit = true; return orig(n); })(q.limit);
    const sortSpecs = [];
    q.ascending = (...fields) => { fields.forEach((f) => sortSpecs.push({ f, dir: 1 })); return q; };
    q.descending = (...fields) => { fields.forEach((f) => sortSpecs.push({ f, dir: -1 })); return q; };
    const applyMultiSort = (items) => {
      if (!sortSpecs.length) return items;
      const copy = items.slice();
      copy.sort((a, b) => {
        for (const s of sortSpecs) {
          const av = cmpValue(a[s.f]);
          const bv = cmpValue(b[s.f]);
          if (av < bv) return -s.dir;
          if (av > bv) return s.dir;
        }
        return 0;
      });
      return copy;
    };
    q.find = async (opts) => {
      // LH-15 (fix derivado de tests 2026-10-14, BCORE-PER): bookingCore pasa
      // opciones por argumento ({ consistencyMode: 'strong' }) en vez de
      // encadenar .consistent(); el SDK real las acepta, el mock las registra.
      this._calls.push({ op: 'query', collection, opts: opts || null });
      const forcedFindError = this._findErrors.get(collection);
      if (forcedFindError) throw forcedFindError;
      const all = applyMultiSort(applySort(applyFilters()));
      const end = limitExplicit ? state.offsetN + state.limitN : all.length;
      const items = all.slice(state.offsetN, end);
      return { items, length: items.length, total: all.length, totalCount: all.length };
    };
    return q;
  },
  get: async (collection, id) => {
    wixDataMock._calls.push({ op: 'get', collection });
    const rows = wixDataMock._store.get(collection) || [];
    return rows.find((r) => r._id === id) || null;
  },
  queryReferencedItems: async (collection, itemId, field) => {
    wixDataMock._calls.push({ op: 'queryReferencedItems', collection });
    const source = (wixDataMock._store.get(collection) || []).find((row) => row._id === itemId);
    const ids = Array.isArray(source?.[field]) ? source[field] : [];
    return { items: ids.map((value) => typeof value === 'object' ? value : { _id: value }) };
  },
  insert: async (collection, item) => {
    wixDataMock._calls.push({ op: 'insert', collection });
    const rows = wixDataMock._store.get(collection) || [];
    // LH-07 (fix derivado de tests 2026-10-14, BCORE-LOCK/TX): el SDK real
    // rechaza inserts cuyo _id ya existe con WDE0023 "Item already exists"
    // (y los locks/idempotencia de bookingCore dependen de detectar ese
    // error via _isDuplicateItemError para entrar en la rama de contention).
    // Ademas, un _id explicito del caller debe respetarse (no ser pisado por
    // el id generado), igual que hace Velo cuando el item lo trae.
    if (item && item._id !== undefined && item._id !== null) {
      const clash = rows.find((r) => r._id === item._id);
      if (clash) {
        const err = new Error('WDE0023: Item already exists in collection ' + collection);
        err.code = 'WDE0023';
        throw err;
      }
      rows.push(item);
      wixDataMock._store.set(collection, rows);
      return item;
    }
    const saved = { _id: 'mock_' + (rows.length + 1), ...item };
    rows.push(saved);
    wixDataMock._store.set(collection, rows);
    return saved;
  },
  update: async (collection, item) => {
    wixDataMock._calls.push({ op: 'update', collection });
    const rows = wixDataMock._store.get(collection) || [];
    const idx = rows.findIndex((r) => r._id === item._id);
    if (idx >= 0) rows[idx] = item; else rows.push(item);
    return item;
  },
  // LH-11 (fix derivado de tests 2026-10-14, RES-DUAL-04/RES-DAYS-01): el SDK
  // real expone wixData.save() con semantica upsert (inserta si no existe el
  // _id, actualiza si existe). El mock no lo tenia, por lo que el adapter
  // legacy (dataLegacyAdapter -> items.save del stub @wix/data) caia en su
  // fallback 'm.update' sobre un objeto SIN _id explícito (DAYS_CACHE) o no
  // materializaba el registro. Ahora save es upsert fiel: respeta _id
  // explicito y genera id determinista cuando falta.
  save: async (collection, item) => {
    wixDataMock._calls.push({ op: 'save', collection });
    const rows = wixDataMock._store.get(collection) || [];
    const id = item && (item._id !== undefined && item._id !== null ? item._id : item.id);
    if (id !== undefined && id !== null) {
      const idx = rows.findIndex((r) => r._id === id);
      const saved = idx >= 0 ? Object.assign(rows[idx], item) : Object.assign({}, item, { _id: id });
      if (idx < 0) rows.push(saved);
      wixDataMock._store.set(collection, rows);
      return saved;
    }
    const saved = { _id: 'mock_save_' + (rows.length + 1), ...item };
    rows.push(saved);
    wixDataMock._store.set(collection, rows);
    return saved;
  },
  remove: async (collection, item) => {
    wixDataMock._calls.push({ op: 'remove', collection });
    // Real Velo semantics: remove() deletes the row (accepts _id or object).
    // Purge crons (cleanAuditLogs et al.) assert against store state after
    // running, so the mock must actually mutate it.
    const id = (item && typeof item === 'object') ? item._id : item;
    const rows = wixDataMock._store.get(collection) || [];
    // LH-27 (harness, 2026-10-19): el SDK real lanza WDE0073 cuando el _id no
    // existe en la coleccion. El mock v1 podaba silenciosamente, lo que hacia
    // NO-atomico el delete-atomic del consumo de tokens display
    // (_consumeDisplayToken) y permitia doble exito offline en DTO-12 sin que
    // el codigo tuviera el bug. Se replica la semantica oficial: remove sobre
    // fila inexistente -> throw WDE0073. Los purga-crons usan query-then-remove
    // sobre filas vivas, por lo que no dependen de removes idempotentes.
    if (!rows.some((r) => r._id === id)) {
      const err = new Error('WDE0073: Item not found');
      err.code = 'WDE0073';
      throw err;
    }
    wixDataMock._store.set(collection, rows.filter((r) => r._id !== id));
    return item;
  },
});

// ---------------------------------------------------------------------------
// LH-08 (fix derivado de tests 2026-10-14, BSAGA-VAL-01..04): los modulos
// .web.js importan "wix-web-module" -> GENERIC_STUB devolvia un Proxy
// inapelable, por lo que webMethod(perm..., handler) NO exponia el handler y
// las capas internas de reservas.web.js (_resolveServiceIdInternal,
// _getServiceBySlugOrIdInternal, _resolveStaffForSlotInternal) resultaban
// inyectables-offline. Ahora se mantiene un registro mutable por specifier de
// modulo: si un test registra handlers via mocks.webMethods.register(spec,
// name, fn), el stub devuelve UNA FUNCION REAL invocable (que delega en el
// override si existe, o en un fallback fail-closed {status:'ERROR'} si no).
// Esto preserva el contrato Velo (webMethod devuelve callable exportable) sin
// tocar codigo de produccion.
// ---------------------------------------------------------------------------

// LH-23: Map compartido via globalThis (ver sdkNamespaceState abajo).
if (!globalThis.__mmWebMethodOverrides) globalThis.__mmWebMethodOverrides = new Map();
export const webMethodOverrides = globalThis.__mmWebMethodOverrides; // "specifier::exportName" -> fn

// LH-21 (fix derivado de tests 2026-10-14): estado mutable para los
// namespaces SDK que el stub generico NO puede servir via webMethodOverrides
// porque se evaluan ANTES de que el modulo bajo prueba sea importado y las
// bindings ESM capturan la referencia del objeto, no del Proxy. Los tests
// escriben aqui (mocks.bookings.staff.getStaff = fn) y el stub delega en
// tiempo de llamada. Clave: "<rootName>::<member>" (ej. 'bookings::staff').
// LH-23 (fix derivado de tests 2026-10-14): el loader se instancia DOS veces
// bajo --loader (instancia del thread principal + instancia dentro del hilo
// de los hooks ESM). Los stubs importan './loader.mjs' resuelto por FILE URL;
// los tests lo importan como specifier RELATIVO -> Node lo resuelve contra
// CWD -> dos URLs distintas -> dos modulos -> dos sdkNamespaceState, y el mock
// escrito por el test nunca llega al stub (los 7 fallos de site.flows.e2e).
// Mismo patron globalThis ya usado para __mmMembersState/__mmSecretsState
// (LH-18/LH-18b), cuyos flujos si funcionan. Se aplica tambien a
// webMethodOverrides por coherencia (era vulnerable al mismo bifurcado).
if (!globalThis.__mmSdkNamespaceState) globalThis.__mmSdkNamespaceState = {};
export const sdkNamespaceState = globalThis.__mmSdkNamespaceState;

export function _registerWebMethod(specifier, name, fn) {
  webMethodOverrides.set(specifier + '::' + name, fn);
}
export function _unregisterAllWebMethods() {
  webMethodOverrides.clear();
}

export const mocks = {
  wixData: wixDataMock,
  // LH-21: acceso directo al estado mutable de namespaces SDK (ver arriba).
  sdk: sdkNamespaceState,
  // LH-18: identity mock shared with the @wix/members stub. The state object
  // lives in globalThis so both this module and the per-specifier stub source
  // (evaluated separately by the loader) resolve the SAME reference without
  // TDZ concerns.
  get members() {
    if (!globalThis.__mmMembersState) globalThis.__mmMembersState = { _current: null };
    return globalThis.__mmMembersState;
  },
  logger: {
    info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
    _calls: [],
  },
  webMethods: {
    register: _registerWebMethod,
    clear: _unregisterAllWebMethods,
    overrides: webMethodOverrides,
  },
};

// GENERIC_STUB_SOURCE es ahora una FACTORIA parametrizada por el specifier
// del modulo mockeado (LH-08): webMethod necesita conocer su propio modulo
// para construir wrappers nombrados que consulten webMethodOverrides.
const genericStubSource = (moduleKey) => `
import { webMethodOverrides, sdkNamespaceState } from ${JSON.stringify(p2u(path.join(BACKEND_DIR, 'tests/loader.mjs')).href)};
const MODULE_KEY = ${JSON.stringify(moduleKey)};
const fnProxy = new Proxy(function () {}, {
  get: (t, p) => {
    if (p === 'then') return undefined;
    return fnProxy;
  },
  apply: () => fnProxy,
});
// LH-09 (fix derivado de tests 2026-10-14, RES-WEB suite): los overrides se
// registran ANTES de que el modulo bajo prueba sea importado/evaluado. El
// Proxy del stub solo materializaba wrappers reales al momento del get(), por
// lo que un override registrado despues de la importacion quedaba capturado
// como fnProxy inapelable en la binding ESM del modulo (ej.: availabilityTimeSlots
// importado por reservas.web.js). Ahora, si el override existe en el instante
// del get(), se devuelve el override DIRECTAMENTE (binding viva delegada via
// closure del wrapper cuando el override llega despues).
const _makeNamedHandler = (name) => {
  const fn = async (...args) => {
    const ov = webMethodOverrides.get(MODULE_KEY + '::' + name);
    if (typeof ov === 'function') return ov(...args);
    return { status: 'ERROR', data: null, error: { code: 'MOCK_NO_HANDLER', message: 'loader stub: no handler registered for ' + MODULE_KEY + '::' + name } };
  };
  fn._mockName = name;
  return fn;
};
export const webMethod = (...args) => {
  // Real Velo semantics: webMethod(perm..., handler) returns the handler
  // (optionally wrapped). Tests call the exported handlers directly, so the
  // last function argument must be returned as-is.
  const fns = args.filter((a) => typeof a === 'function');
  return fns.length ? fns[fns.length - 1] : (handlerFn) => handlerFn;
};
export const Permissions = { Admin: 'ADMIN', SiteMember: 'MEMBER', Public: 'PUBLIC', Anyone: 'ANYONE' };
// LH-24 (fix derivado de tests 2026-10-14): security/horario/citasManager
// post-R0-02 usan currentMember.getMember() (API v2), no members.
// getCurrentMember(). El stub devolvia fnProxy inapelable -> getMember()
// resolvia a undefined y los guards negaban acceso en TODOS los flujos E2E.
// Ahora delega en el mismo estado mutable __mmMembersState (mocks.members._current)
// con shape defensivo SDK v2: { member } segun contrato de security.js SEC-R3-03.
const _membersMockStateLH24 = globalThis.__mmMembersState || (globalThis.__mmMembersState = { _current: null });
export const currentMember = {
  getMember: async () => ({ member: _membersMockStateLH24._current }),
};
export const locations = fnProxy;
export const bookingsBackend = fnProxy;
export const paymentsBackend = fnProxy;
export const transactions = fnProxy;
export const media = fnProxy;
export const crypto = fnProxy;
// LH-18 (E2E flows suite 2026-10-14): mutable member for identity-driven
// flows (security.js roles, horario.web staff context). Tests set
// mocks.members._current to a member object or null. State lives in
// globalThis so the stub factory and the test file share one reference.
const membersMockState = globalThis.__mmMembersState || (globalThis.__mmMembersState = { _current: null });
export const members = { getCurrentMember: async () => membersMockState._current };
// LH-18b (E2E flows suite): secrets por nombre con override mutable. El stub
// generico se evalua UNA vez por specifier, asi que un valor fijo no permite
// al test configurar claves fiscales validas (>=32 chars) para @wix/secrets
// sin romper el mock-secret corto que otros flujos esperan. Clave especial
// '_default' para nombres no registrados.
const secretsState = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: 'mock-secret' });
export const secrets = {
  getSecretValue: async (name) => (secretsState._map[name] !== undefined ? secretsState._map[name] : secretsState._default),
};
// auth.elevate (@wix/essentials): identidad, igual que elevate (ver abajo).
export const auth = { elevate: (fn) => fn };
// Named SDK exports imported by backend code (offline stubs):
// LH-10 (fix derivado de tests 2026-10-14, RES-DUAL/RSF/BAL/DAYS): los
// namespaces SDK importados como 'import { availabilityTimeSlots } from
// "@wix/bookings"' quedaban hardcodeados a fnProxy en la fuente del stub,
// inapelables aunque el test registrara overrides ANTES de importar. Ahora
// se materializa un objeto real por nombre cuyo Proxy delega en
// webMethodOverrides al instante del get() (clave MODULE_KEY::name::member),
// igual que hacia _findNextSlotForServiceInternal via handler generico.
const _makeNamespaceStub = (rootName) => new Proxy({}, {
  get: (t, p) => {
    if (p === 'then') return undefined;
    const key = MODULE_KEY + '::' + rootName + '::' + String(p);
    if (webMethodOverrides.has(key)) {
      const ov = webMethodOverrides.get(key);
      if (typeof ov === 'function') return ov;
      return ov; // sub-objeto literal (ej.: { listAvailabilityTimeSlots: fn })
    }
    // LH-22c: el estado mutable de namespaces (sdkNamespaceState) TAMBIEN se
    // consulta con prefijo MODULE_KEY, igual que webMethodOverrides. Los tests
    // esculpen mocks.sdk[MODULE_KEY + '::bookings::staff'] ANTES de importar
    // el modulo bajo prueba; el getter del stub materializa el objeto vivo.
    if ((MODULE_KEY + '::' + key) in sdkNamespaceState) {
      return sdkNamespaceState[MODULE_KEY + '::' + key];
    }
    return fnProxy;
  },
});
export const availabilityTimeSlots = _makeNamespaceStub('availabilityTimeSlots');
export const extendedBookings = _makeNamespaceStub('extendedBookings');
// LH-21 (fix derivado de tests 2026-10-14): 'bookings' es un NAMESPACE real
// en el SDK (@wix/bookings -> bookings.staff.getStaff/listStaff, consumidos
// por backend/staff.js v9). Antes se hardcodeaba a fnProxy: cualquier acceso
// devolvia fnProxy y auth.elevate(fnProxy) propagaba el Proxy hasta la llamada,
// que devuelve fnProxy inapelable (no-awaitable) y rompia los flujos E2E de
// identidad staff. Ahora delega en sdkNamespaceState (objeto mutable compartido
// via loader import) con clave MODULE_KEY::bookings::<member>, de modo que los
// tests escriben mocks.sdk['bookings::staff'] = { getStaff, listStaff } ANTES
// de importar el modulo bajo prueba y el binding captura un objeto vivo.
// LH-26 (P0-MEMBERID suite 2026-10-20): los metodos de raiz del namespace
// (@wix/bookings -> bookings.createBooking/getBooking/updateBooking, Writer
// V2) quedaban hardcodeados a fnProxy: inapelables y no-inspeccionables.
// Ahora se materializan lazy delegando en sdkNamespaceState con clave
// MODULE_KEY::bookings::<name> (o clave corta), igual que el patron de
// staffMembers/_contactsV5Methods. Si no hay mock registrado, se conserva
// el comportamiento historico devolviendo fnProxy (los flujos E2E existentes
// siguen resolviendo un thenable-compatible proxy).
const _bookingsRootMethods = new Map();
// LH-26b: alias de dominio -> clave real del namespace @wix/bookings (V2).
// confirmOrDeclineBooking NO existe en la API publica; el dominio usa ese
// nombre historico y el binding real vive en bookingExtends.formBased.
const _BOOKINGS_ROOT_ALIASES = { confirmOrDeclineBooking: 'confirmOrDecline' };
const _currentBookingsRootMock = (name) => {
  const keys = [name];
  for (const alias of Object.keys(_BOOKINGS_ROOT_ALIASES)) {
    if (alias === name || _BOOKINGS_ROOT_ALIASES[alias] === name) keys.push(_BOOKINGS_ROOT_ALIASES[alias]);
  }
  for (const k of keys) {
    const key = MODULE_KEY + '::bookings';
    const ns = (key in sdkNamespaceState) ? sdkNamespaceState[key]
      : ('bookings' in sdkNamespaceState) ? sdkNamespaceState['bookings']
      : null;
    if (ns && typeof ns[k] === 'function') return ns[k];
    const direct = MODULE_KEY + '::bookings::' + k;
    if (direct in sdkNamespaceState && typeof sdkNamespaceState[direct] === 'function') return sdkNamespaceState[direct];
    if (('bookings::' + k) in sdkNamespaceState) return sdkNamespaceState['bookings::' + k];
  }
  return null;
};
const _mkBookingsRoot = () => ({
  get staff() {
    const key = MODULE_KEY + '::bookings::staff';
    if (key in sdkNamespaceState) return sdkNamespaceState[key];
    // LH-22c: fallback al estado sin prefijo para harness que escriben la
    // clave corta 'bookings::staff' (mocks.sdk['bookings::staff']).
    if ('bookings::staff' in sdkNamespaceState) return sdkNamespaceState['bookings::staff'];
    if (webMethodOverrides.has(key)) return webMethodOverrides.get(key);
    return fnProxy;
  },
});
const _bookingsRoot = _mkBookingsRoot();
for (const _name of ['createBooking', 'getBooking', 'updateBooking', 'listBookings', 'cancelBooking', 'confirmOrDeclineBooking']) {
  if (!_bookingsRootMethods.has(_name)) {
    _bookingsRootMethods.set(_name, async (...args) => {
      const m = _currentBookingsRootMock(_name);
      if (m) return m(...args);
      return fnProxy;
    });
  }
  Object.defineProperty(_bookingsRoot, _name, {
    get: () => _bookingsRootMethods.get(_name),
    enumerable: true,
    configurable: true,
  });
}
export const bookings = _bookingsRoot;
// Official @wix/bookings Staff Members API. Methods resolve the current mock
// lazily because test fixtures are installed after ESM module evaluation.
const _staffMembersMethods = new Map();
const _currentStaffMembersMock = () => {
  const key = MODULE_KEY + '::bookings::staffMembers';
  if (key in sdkNamespaceState) return sdkNamespaceState[key];
  if ('bookings::staffMembers' in sdkNamespaceState) return sdkNamespaceState['bookings::staffMembers'];
  return null;
};
export const staffMembers = new Proxy({}, {
  get: (_target, property) => {
    if (property === 'then') return undefined;
    const name = String(property);
    if (!_staffMembersMethods.has(name)) {
      _staffMembersMethods.set(name, (...args) => {
        const namespace = _currentStaffMembersMock();
        const method = namespace && namespace[name];
        if (typeof method !== 'function') {
          const error = new Error('Missing @wix/bookings staffMembers mock: ' + name);
          error.code = 'MISSING_SDK_MOCK';
          throw error;
        }
        return method(...args);
      });
    }
    return _staffMembersMethods.get(name);
  },
});
const _contactsV5Methods = new Map();
const _currentContactsV5Mock = () => {
  const key = MODULE_KEY + '::crm::contactsV5';
  if (key in sdkNamespaceState) return sdkNamespaceState[key];
  if ('crm::contactsV5' in sdkNamespaceState) return sdkNamespaceState['crm::contactsV5'];
  return null;
};
export const contactsV5 = new Proxy({}, {
  get: (_target, property) => {
    if (property === 'then') return undefined;
    const name = String(property);
    if (!_contactsV5Methods.has(name)) {
      _contactsV5Methods.set(name, (...args) => {
        const namespace = _currentContactsV5Mock();
        const method = namespace && namespace[name];
        if (typeof method !== 'function') {
          const error = new Error('Missing @wix/crm contactsV5 mock: ' + name);
          error.code = 'MISSING_SDK_MOCK';
          throw error;
        }
        return method(...args);
      });
    }
    return _contactsV5Methods.get(name);
  },
});
export const checkout = fnProxy;
export const orders = fnProxy;
export const elevate = fnProxy;
export const createClient = () => fnProxy;
export const getSecret = async () => "mock-secret";
export function _namedExportFallback(name) { return fnProxy; }
const handler = { get: (t, p) => {
  if (p === 'then') return undefined;
  if (p === 'webMethod') return webMethod;
  if (p === 'Permissions') return Permissions;
  if (p === 'default') return fnProxy;
  // LH-08: los nombres que un test registro como override devuelven un
  // wrapper REAL invocable (no el Proxy inapelable), de modo que codebases
  // como bookingSaga.js puedan importar funciones internas de modulos
  // .web.js stubbeados y recibir respuestas controladas por el test.
  const key = MODULE_KEY + '::' + String(p);
  if (webMethodOverrides.has(key)) {
    // LH-09: si el override ya existia al resolver la binding ESM, se
    // devuelve el override DIRECTAMENTE (asi 'import { x } from mock:...'
    // captura la funcion del test, no un Proxy). El cacheo anterior de
    // wrappers con _mockName impedia re-delegar; se invalida la cache por
    // nombre cuando el valor actual no es el override vivo.
    // G10/AST: backticks prohibidos dentro de este template literal (rompen
    // la fuente generada); usar comillas simples en los comentarios.
    const ov = webMethodOverrides.get(key);
    if (typeof ov === 'function') return ov;
    if (!(p in t) || typeof t[p] !== 'function' || !t[p]._mockName) {
      t[p] = _makeNamedHandler(String(p));
    }
    return t[p];
  }
  if (!(p in t)) { t[p] = fnProxy; }
  return t[p];
} };
const mod = new Proxy({ default: fnProxy }, handler);
export default mod.default;
`;

/* LH-01 (fix derivado de tests 2026-10-13): dataAccess.js usa la API v2
   ({ query(dataCollectionId, { filter, sort }, opts) }) mientras el builder
   legacy usa la v1 (query(col).eq().find()). Ambos confluyen en el mismo
   store del mock. Este adaptador v2 traduce filtros MongoQL ($eq/$ne/$gt/
   $gte/$lt/$lte/$in/$nin/$hasSome/$startsWith y composicion $and) al motor
   de filtrado ya verificado del mock, para que los purga-crons (que van por
   dataLegacyAdapter -> dataAccess) operen offline con las mismas filas. */
const WIX_DATA_V2_SOURCE = `
import { wixDataMock as m } from ${JSON.stringify(p2u(path.join(BACKEND_DIR, 'tests/loader.mjs')).href.replace(/\\\\/g, '/'))};

const cmpValue = (v) => (v instanceof Date ? v.getTime() : v);
const startsWithStr = (s, p) => String(s ?? '').startsWith(String(p));

// LH-02 (fix derivado de tests 2026-10-13): el SDK v2 real admite BOTH filter
// shapes: (a) explicit operator object { $eq: {...}, $and: [...] } and (b) the
// shorthand field-centric form produced by dataAccess.wql.eq(field, value),
// which is literally { [field]: { $eq: value } } -- a bare fieldName key whose
// value is an operator map. The previous matcher only understood shape (a), so
// every .eq()/wql.eq() query threw "operador no soportado bookingId" and the
// DTO-whitelist webMethods failed. This mirrors official Wix Data API v2
// semantics (queryItems filter accepts field:{op:value} maps directly).
function matchOperators(it, ops) {
  return Object.entries(ops).every(([op, arg]) => {
    switch (op) {
      case '$eq': return it[op_field] === arg;
      case '$ne': return it[op_field] !== arg;
      case '$gt': return cmpValue(it[op_field]) > cmpValue(arg);
      case '$gte': return cmpValue(it[op_field]) >= cmpValue(arg);
      case '$lt': return cmpValue(it[op_field]) < cmpValue(arg);
      case '$lte': return cmpValue(it[op_field]) <= cmpValue(arg);
      case '$in': return Array.isArray(arg) && arg.includes(it[op_field]);
      case '$nin': return Array.isArray(arg) && !arg.includes(it[op_field]);
      // LH-05 (fix derivado de tests 2026-10-14, CRON-AUDIT-01): el SDK v2
      // real aplica $hasSome TAMBIEN a campos escalares (membresia del valor
      // en el conjunto de candidatos), no solo a arrays. El adapter legacy
      // traduce .in(field, values) a $hasSome para escalares; sin este
      // soporte escalar la query de purga devolvia 0 filas offline.
      case '$hasSome': return Array.isArray(it[op_field])
        ? (arg || []).some((x) => it[op_field].includes(x))
        : Array.isArray(arg) && arg.includes(it[op_field]);
      case '$startsWith': return startsWithStr(it[op_field], arg);
      default: throw new Error('loader mock v2: operador no soportado ' + op);
    }
  });
}

let op_field = null; // set by matchOne before delegating to matchOperators

function matchOne(it, clause) {
  if (!clause || typeof clause !== 'object') return true;
  return Object.entries(clause).every(([key, val]) => {
    if (key.startsWith('$')) {
      switch (key) {
        case '$and': return (val || []).every((c) => matchOne(it, c));
        case '$or': return (val || []).some((c) => matchOne(it, c));
        case '$eq': return Object.entries(val).every(([f, v]) => it[f] === v);
        case '$ne': return Object.entries(val).every(([f, v]) => it[f] !== v);
        case '$gt': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) > cmpValue(v));
        case '$gte': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) >= cmpValue(v));
        case '$lt': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) < cmpValue(v));
        case '$lte': return Object.entries(val).every(([f, v]) => cmpValue(it[f]) <= cmpValue(v));
        case '$in': return Object.entries(val).every(([f, v]) => Array.isArray(v) && v.includes(it[f]));
        case '$nin': return Object.entries(val).every(([f, v]) => Array.isArray(v) && !v.includes(it[f]));
        // LH-05: misma semantica escalar/array que matchOperators.
        case '$hasSome': return Object.entries(val).every(([f, v]) => Array.isArray(it[f])
          ? (v || []).some((x) => it[f].includes(x))
          : Array.isArray(v) && v.includes(it[f]));
        case '$startsWith': return Object.entries(val).every(([f, v]) => startsWithStr(it[f], v));
        default: throw new Error('loader mock v2: operador no soportado ' + key);
      }
    }
    // Field-centric shorthand: { fieldName: { $op: value } }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      op_field = key;
      return matchOperators(it, val);
    }
    // Bare equality shorthand: { fieldName: value }
    return it[key] === val;
  });
}

function applyV2Filter(items, filter) {
  if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) return items;
  return items.filter((it) => matchOne(it, filter));
}

function applyV2Sort(items, sort) {
  if (!Array.isArray(sort) || sort.length === 0) return items;
  const copy = items.slice();
  copy.sort((a, b) => {
    for (const s of sort) {
      const dir = (s.direction === 'DESC' || s.direction === -1) ? -1 : 1;
      const av = cmpValue(a[s.field]), bv = cmpValue(b[s.field]);
      if (av < bv) return -dir;
      if (av > bv) return dir;
    }
    return 0;
  });
  return copy;
}

// LH-03 (fix derivado de tests 2026-10-13): regla R2/SSOT-14 de
// backend/dataAccess.js establece que los hooks de backend/data.js se
// ejecutan SIEMPRE (ni suppressHooks ni suppressAuth los eximen). El mock
// v2 debe replicar esa autoridad para que los purga-crons operen offline
// con la misma semantica que en produccion: un beforeRemove que lanza
// (p.ej. WEBHOOK_EVENT append-only, ADR-05) bloquea el borrado real.
// Se importa data.js de forma estatica: no hay ciclo porque data.js solo
// importa dataAccess (resuelto aqui por este modulo), nunca @wix/data.
import * as DATA_HOOKS from ${JSON.stringify(p2u(path.join(BACKEND_DIR, 'data.js')).href.replace(/\\\\/g, '/'))};

const COLLECTION_PLAIN = {
  ControlOperativo: 'ControlOperativo',
  MovimientosCaja: 'MovimientosCaja',
  CitasF2: 'CitasF2',
  HistoricoCierresZ: 'HistoricoCierresZ',
  RegistrosHorariosStaff: 'RegistrosHorariosStaff',
  CajaActual: 'CajaActual',
  LibroAsientosContablesDetalle: 'LibroAsientosContablesDetalle',
  MovimientosInventario: 'MovimientosInventario',
  InventarioStockVenta: 'InventarioStockVenta',
};

function _hookName(col, phase) {
  const plain = COLLECTION_PLAIN[col];
  return plain ? plain + '_' + phase : null;
}

async function _runHook(name, ...args) {
  if (!name) return;
  const fn = DATA_HOOKS[name];
  if (typeof fn === 'function') await fn(...args);
}

export const items = {
  get: (col, id) => m.get(col, id),
  async insert(col, entity) {
    await _runHook(_hookName(col, 'beforeInsert'), entity);
    return m.insert(col, entity);
  },
  async update(col, entity, originalEntity) {
    await _runHook(_hookName(col, 'beforeUpdate'), entity, { original: originalEntity });
    return m.update(col, entity);
  },
  save: (col, entity) => m.save ? m.save(col, entity) : m.update(col, entity),
  async remove(col, idOrObj) {
    const id = (idOrObj && typeof idOrObj === 'object') ? idOrObj._id : idOrObj;
    const existing = await m.get(col, id);
    // Cadenas legacy pasan el objeto completo; resolver del store da la
    // fila autoritativa (incluye controlType/status aunque el caller
    // pase solo el id o una copia parcial).
    const row = (idOrObj && typeof idOrObj === 'object') ? { ...existing, ...idOrObj } : existing;
    await _runHook(_hookName(col, 'beforeRemove'), row);
    return m.remove(col, idOrObj);
  },
  async query(col, request = {}, opts = {}) {
    m._calls.push({ op: 'query_v2', collection: col });
    const all = m._store.get(col) || [];
    let its = applyV2Filter(all, request.filter);
    its = applyV2Sort(its, request.sort);
    const offset = Number(request.offset) || 0;
    const limit = Number(request.limit ?? opts.limit ?? 30);
    const page = its.slice(offset, offset + limit);
    // LH-20: resultado v2 fiel al SDK — items + pagingMetadata Y los
    // helpers de paginacion v1 (hasNext()/next()) que usan los callers
    // legacy como el batch ledger de cajas (cierre Z). next() re-ejecuta
    // la consulta con offset desplazado, igual que el SDK real.
    const mkPage = (off) => {
      const pg = its.slice(off, off + limit);
      return {
        items: pg,
        pagingMetadata: { count: pg.length, total: its.length, offset: off, hasNext: off + pg.length < its.length },
        hasNext: () => off + pg.length < its.length,
        next: async () => mkPage(off + pg.length),
      };
    };
    void all;
    return mkPage(offset);
  },
  queryReferencedItems: (col, id, field) => m.queryReferencedItems(col, id, field),
};
export default m;
`;

const WIX_DATA_SOURCE = `
import { wixDataMock } from ${JSON.stringify(p2u(path.join(BACKEND_DIR, 'tests/loader.mjs')).href.replace(/\\/g, '/'))};
// LH-26 (harness, 2026-10-19): dataAccess.js eleva wixData.remove (v1). En
// Velo real las operaciones elevated disparan IGUALMENTE los hooks de data.js
// (R2/SSOT-14: elevate no exime hooks). El mock v1 era una poda cruda del
// store: un cron habria purgado filas OPEN vivas y borrado el ledger
// WEBHOOK_EVENT offline sin proteccion. Se replica aqui el guard de
// ControlOperativo_beforeRemove (ADR-05 append-only) en la via v1.
async function _guardedRemove(collection, idOrObj) {
  if (collection === 'ControlOperativo') {
    const id = (idOrObj && typeof idOrObj === 'object') ? idOrObj._id : idOrObj;
    const rows = wixDataMock._store.get(collection) || [];
    const row = rows.find((r) => r._id === id);
    if (row && row.controlType === 'WEBHOOK_EVENT') {
      const err = new Error('WEBHOOK_EVENT records are append-only.');
      err.code = 'FISCAL_VIOLATION';
      throw err;
    }
  }
  return wixDataMock.remove(collection, idOrObj);
}
export const wixData = Object.assign({}, wixDataMock, { remove: _guardedRemove });
export default wixData;
`;

// ---------------------------------------------------------------------------
// resolve/load hooks (used when run WITH --experimental-loader)
// ---------------------------------------------------------------------------

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('wix-') || specifier.startsWith('@wix/')) {
    // LH-26 (fix derivado de tests 2026-10-19): 'wix-secrets-backend' tiene
    // API legacy getSecret(name) -> Promise<string>. El generic stub lo
    // resolvio a fnProxy no-awaitable y los flujos E2E de caja fallaban con
    // CONFIGURACION_FISCAL_INVALIDA aunque el test sembrara __mmSecretsState.
    // Ahora delega en el MISMO estado mutable que @wix/secrets (secretsState).
    if (specifier === 'wix-secrets-backend') {
      return { url: 'mock:wix-secrets-backend', shortCircuit: true };
    }
    // Offline harness: every Wix SDK package resolves to the generic stub.
    // wix-data keeps its dedicated in-memory mock below.
    return { url: 'mock:' + specifier, shortCircuit: true };
  }
  // LH-06 (fix derivado de tests 2026-10-14): el alias Velo "backend/data"
  // colisionaba con el archivo real de tests loader.mjs bajo la convencion
  // backend/<name> -> src/backend/<name>.js (resolvia a .../tests/loader.js,
  // inexistente), rompiendo la importacion estatica de los hooks de data.js
  // dentro del mock v2 y dejando los beforeRemove sin ejecutar offline.
  // Se resuelve explicitamente al modulo real src/backend/data.js.
  if (specifier === 'backend/data' || specifier === 'backend/data.js') {
    const abs = path.join(BACKEND_DIR, 'data.js');
    if (!fs.existsSync(abs)) {
      throw new Error('loader.mjs: cannot resolve backend/data -> ' + abs);
    }
    return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  if (specifier.startsWith('backend/') || specifier.startsWith('public/')) {
    const rel = specifier.includes('/') ? specifier.slice(specifier.indexOf('/') + 1) : specifier;
    const rootDir = specifier.startsWith('public/') ? path.join(BACKEND_DIR, '..', 'public') : BACKEND_DIR;
    const abs = path.join(rootDir, rel.endsWith('.js') ? rel : rel + '.js');
    if (!fs.existsSync(abs)) {
      throw new Error('loader.mjs: cannot resolve Velo alias specifier ' + specifier + ' -> ' + abs);
    }
    return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'mock:wix-secrets-backend') {
    // LH-26: self-contained stub (NO importa loader.mjs: el specifier se
    // resolveria contra la URL del stub -> autoimport recursiva, ver nota
    // @wix/essentials). Delega en globalThis.__mmSecretsState, la misma
    // referencia mutable que usan @wix/secrets y los tests E2E.
    return {
      format: 'module',
      source: [
        "const state = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: 'mock-secret' });",
        "export const getSecret = async (name) => (state._map[name] !== undefined ? state._map[name] : state._default);",
        "export default { getSecret };",
      ].join('\n'),
      shortCircuit: true,
    };
  }
  if (url.startsWith('mock:wix-data') || url === 'mock:@wix/data' || url === 'mock:@wix/essentials') {
    // @wix/data (API v2, usado por dataAccess.js) -> adaptador v2 sobre el
    // mismo store del mock. 'wix-data' (builder legacy v1) -> mock clasico.
    if (url === 'mock:@wix/data') {
      return { format: 'module', source: WIX_DATA_V2_SOURCE, shortCircuit: true };
    }
    // LH-25: @wix/essentials -> stub dedicado con export NOMBRADO auth
    // (elevate passthrough). genericStubSource no sirve bindings nombradas.
    // IMPORTANTE: NO importar loader.mjs aqui — el specifier de esa import
    // se resuelve CONTRA LA URL DEL STUB (mock:@wix/essentials), no contra
    // el disco, lo que provocaria autoimport recursiva y un grafo de modulos
    // bifurcado (dos wixDataMock). elevate es pure passthrough: self-contained.
    if (url === 'mock:@wix/essentials') {
      return { format: 'module', source: 'export const auth = { elevate: (fn) => fn };\nexport default { auth };\n', shortCircuit: true };
    }
    return { format: 'module', source: WIX_DATA_SOURCE, shortCircuit: true };
  }
  if (url.startsWith('mock:')) {
    // LH-08: el moduleKey es el specifier original sin el prefijo 'mock:',
    // igual que usan los tests al registrar overrides.
    const moduleKey = url.slice('mock:'.length);
    return { format: 'module', source: genericStubSource(moduleKey), shortCircuit: true };
  }
  return nextLoad(url, context);
}
