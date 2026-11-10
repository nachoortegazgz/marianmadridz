/*
=============================================================================
MODULE: backend/horario.web.js
VERSION: v8.1-SSOT-MASTER
RESPONSIBILITY: Fichajes laborales (RD 8/2019). Append-only. Firma HMAC.
CORRECTIONS: C-01 (sin active), C-03/C-04 (memberId), BUG-04 FIX (campos
             inexistentes eliminados: employeeIdentifier/employeeName/
             recordingName/deviceIp/type → recordType).
=============================================================================
*/

import { query as dalQuery, insertItem as insert } from "backend/dataAccess";
import { webMethod, Permissions } from "wix-web-module";
/* @wix/members backend SDK: Get My Member devuelve el miembro actual. */
import { members } from "@wix/members";

import {
    BUSINESS_COLLECTIONS,
    CLOCK_EVENT_TYPE,
    RECORD_TYPE_HORARIOS,
    CLOCK_REGISTERED_BY,
    REGISTROS_HORARIOS_FIELDS as F,
    SDK_CONFIG,
    SECRETS,
} from "backend/internalConfig";

import {
    assertRegistrosHorariosStaff,
    assertValidEnum,
} from "backend/validation";

import {
    findStaffByContactId,
    findStaffByResourceId,
    getSiteMemberIdByContactId,
    getStaffDisplayName,
} from "backend/staff";

import { requireAdmin } from "backend/security";
import { signTimeclockRecord, verifyTimeclockSignature } from "backend/securityEngine";
import { getSecretValue } from "backend/secretAccess";
/* HOR-R3-03 (DUP-02): _safeTrim importado de mmUtils (SSOT). Helper local
 * eliminado. */
import { makeTraceId, _safeTrim } from "public/mmUtils";
import { logger } from "backend/logger";

const log = logger;
const REGISTROS_COL = BUSINESS_COLLECTIONS.REGISTROS_HORARIOS_STAFF;

// =============================================================================
// HELPERS DE ZONA HORARIA (Europe/Madrid, SSOT)
// =============================================================================

function _getMadridNow() {
    return new Date(
        new Date().toLocaleString("en-US", { timeZone: SDK_CONFIG.TZ })
    );
}

function _getMadridDayKey(d) {
    const date = d || _getMadridNow();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function _getMadridMonthKey(d) {
    const date = d || _getMadridNow();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function _getMadridTime(d) {
    const date = d || _getMadridNow();
    return date.toTimeString().slice(0, 8); // HH:MM:SS
}

function _getDayKeysInRange(startValue, endValue, maxDays = 31) {
    const startKey = _safeTrim(startValue || "");
    const endKey = _safeTrim(endValue || startKey);
    const parse = (value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return null;
        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        return date.toISOString().slice(0, 10) === value ? date : null;
    };
    const start = parse(startKey);
    const end = parse(endKey);
    if (!start || !end || end.getTime() < start.getTime()) return null;
    const days = [];
    for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
        days.push(new Date(time).toISOString().slice(0, 10));
        if (days.length > maxDays) return null;
    }
    return days;
}

async function _getTimeclockIntegrity(records) {
    const items = Array.isArray(records) ? records : [];
    if (items.length === 0) {
        return { allVerified: true, unverifiedCount: 0, verified: [] };
    }
    const key = await getSecretValue(SECRETS.FISCAL_KEY);
    if (!key) {
        return {
            allVerified: false,
            unverifiedCount: items.length,
            verified: items.map(() => false),
        };
    }
    const verified = await Promise.all(items.map((record) => verifyTimeclockSignature(record, key)));
    return {
        allVerified: verified.every(Boolean),
        unverifiedCount: verified.filter((value) => !value).length,
        verified,
    };
}

function _validateTimeclockSequence(records) {
    let state = "OUT";
    for (const record of records || []) {
        const eventType = record?.[F.CLOCK_EVENT_TYPE];
        if (eventType === CLOCK_EVENT_TYPE.ENTRADA) {
            if (state !== "OUT") return { valid: false, state };
            state = "WORKING";
        } else if (eventType === CLOCK_EVENT_TYPE.PAUSA_INICIO) {
            if (state !== "WORKING") return { valid: false, state };
            state = "PAUSED";
        } else if (eventType === CLOCK_EVENT_TYPE.PAUSA_FIN) {
            if (state !== "PAUSED") return { valid: false, state };
            state = "WORKING";
        } else if (eventType === CLOCK_EVENT_TYPE.SALIDA) {
            if (state !== "WORKING") return { valid: false, state };
            state = "OUT";
        } else {
            return { valid: false, state };
        }
    }
    return { valid: true, state };
}

/* HOR-R3-03 (DUP-02): _safeTrim local ELIMINADO. Importado de mmUtils. */

// =============================================================================
// RESOLUCION DE CONTEXTO STAFF (C-03: memberId, sin guard active)
// =============================================================================

async function _resolveStaffContext(traceId) {
    try {
        /* @wix/members backend SDK: respuesta de Get My Member. */
        const response = await members.getCurrentMember();
        const member = response?.member || response;
        if (!member || member.status === "ERROR") return null;

        const memberId = _safeTrim(member._id || member.id || "");
        const contactId = _safeTrim(member.contactId || "");
        const email = _safeTrim(
            member.loginEmail || member.contactDetails?.email
        ).toLowerCase();
        if (!contactId) return null;

        const staff = await findStaffByContactId(contactId, traceId);
        if (!staff) return null;

        return {
            memberId,
            contactId: staff.contactId,
            email,
            resourceId: staff.resourceId,
            displayName: getStaffDisplayName(staff),
            rolWebsite: staff.roleWebsite,
        };
    } catch (error) {
        log.error("_resolveStaffContext failed", {
            traceId,
            message: error?.message || String(error),
        });
        return null;
    }
}

// =============================================================================
// WEBMETHODS PUBLICOS (BIBLIA 14.7)
// =============================================================================

export const getMyStaffContext = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("staff-ctx");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "NOT_STAFF", message: "Miembro sin ficha staff activa" },
                };
            }
            // DTO publico whitelist (RGPD): nunca notes/thirdPartyId
            return {
                status: "OK",
                data: {
                    resourceId: ctx.resourceId,
                    memberId: ctx.memberId,
                    displayName: ctx.displayName,
                    rolWebsite: ctx.rolWebsite,
                },
                traceId,
            };
        } catch (error) {
            log.error("getMyStaffContext failed", { traceId, message: String(error) });
            return {
                status: "ERROR",
                data: null,
                error: { code: "INTERNAL", message: "Error resolviendo contexto staff" },
                traceId,
            };
        }
    }
);

export const registrarFichaje = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("fichaje");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "NOT_STAFF", message: "Miembro sin ficha staff activa" },
                };
            }

            const clockEventType = _safeTrim(options?.clockEventType).toUpperCase();
            assertValidEnum(clockEventType, CLOCK_EVENT_TYPE, "clockEventType");

            const now = _getMadridNow();
            const dayKey = _getMadridDayKey(now);
            const monthKey = _getMadridMonthKey(now);
            const recordedTime = _getMadridTime(now);

            // BUG-04 FIX: solo campos del schema canonico (cms.v8.1-FINAL)
            const record = {
                [F.RESOURCE_ID]: ctx.resourceId,
                [F.MEMBER_ID]: ctx.memberId,
                [F.STAFF_NAME]: ctx.displayName,
                [F.RECORDED_AT]: now,
                [F.RECORDED_TIME]: recordedTime,
                [F.DAY_KEY]: dayKey,
                [F.MONTH_KEY]: monthKey,
                [F.CLOCK_EVENT_TYPE]: clockEventType,
                [F.RECORD_TYPE]: RECORD_TYPE_HORARIOS.REGULAR,
                [F.REGISTERED_BY]: CLOCK_REGISTERED_BY.SELF,
                [F.REGISTERED_BY_MEMBER_ID]: ctx.memberId,
                [F.ADJUSTMENT_REASON]: null,
                [F.DEVICE_IP_ADDRESS]: _safeTrim(options?.deviceIpAddress) || null,
                [F.META]: { userAgent: _safeTrim(options?.userAgent) || null },
                [F.TRACE_ID]: traceId,
            };

            // Firma HMAC de integridad (RD 8/2019)
            record[F.SIGNATURE] = await signTimeclockRecord(record);

            // Validacion centralizada (SSOT-07)
            assertRegistrosHorariosStaff(record);

            const saved = await insert(REGISTROS_COL, record);

            return {
                status: "OK",
                data: {
                    id: saved._id,
                    recordedAt: saved[F.RECORDED_AT],
                    clockEventType: saved[F.CLOCK_EVENT_TYPE],
                },
                traceId,
            };
        } catch (error) {
            log.error("registrarFichaje failed", { traceId, message: String(error) });
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: error?.message?.startsWith("SCHEMA_VIOLATION")
                        ? "SCHEMA_VIOLATION"
                        : "INTERNAL",
                    message: error?.message || "Error registrando fichaje",
                },
                traceId,
            };
        }
    }
);

export const getEstadoJornada = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("estado-jornada");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return { status: "ERROR", data: null, error: { code: "NOT_STAFF" } };
            }

            const dayKey = _safeTrim(options?.dayKey) || _getMadridDayKey();

            const res = await dalQuery(REGISTROS_COL)
                .eq(F.RESOURCE_ID, ctx.resourceId)
                .eq(F.DAY_KEY, dayKey)
                .ascending(F.RECORDED_AT)
                .find();

            const fichajes = res?.items || [];
            const integrity = await _getTimeclockIntegrity(fichajes);
            if (!integrity.allVerified) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TIMECLOCK_INTEGRITY_UNVERIFIED",
                        message: "Hay fichajes sin firma HMAC valida; el estado de jornada requiere revision.",
                        details: { unverifiedCount: integrity.unverifiedCount },
                    },
                    traceId,
                };
            }
            const sequence = _validateTimeclockSequence(fichajes);
            if (!sequence.valid) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TIMECLOCK_SEQUENCE_INVALID", message: "La secuencia de eventos de jornada es inconsistente y requiere revision." },
                    traceId,
                };
            }
            const ultimo = fichajes[fichajes.length - 1] || null;

            let estado = "SIN_INICIAR";
            if (ultimo) {
                switch (ultimo[F.CLOCK_EVENT_TYPE]) {
                    case CLOCK_EVENT_TYPE.ENTRADA:
                        estado = "EN_JORNADA";
                        break;
                    case CLOCK_EVENT_TYPE.PAUSA_INICIO:
                        estado = "EN_PAUSA";
                        break;
                    case CLOCK_EVENT_TYPE.PAUSA_FIN:
                        estado = "EN_JORNADA";
                        break;
                    case CLOCK_EVENT_TYPE.SALIDA:
                        estado = "JORNADA_FINALIZADA";
                        break;
                    default:
                        estado = "EN_JORNADA";
                }
            }

            return {
                status: "OK",
                data: {
                    dayKey,
                    estado,
                    totalFichajes: fichajes.length,
                    ultimoEvento: ultimo
                        ? {
                              tipo: ultimo[F.CLOCK_EVENT_TYPE],
                              registradoEn: ultimo[F.RECORDED_AT],
                          }
                        : null,
                },
                traceId,
            };
        } catch (error) {
            log.error("getEstadoJornada failed", { traceId, message: String(error) });
            return { status: "ERROR", data: null, error: { code: "INTERNAL" }, traceId };
        }
    }
);

export const calcularHorasTrabajadas = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("calc-horas");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return { status: "ERROR", data: null, error: { code: "NOT_STAFF" } };
            }

            const startDayKey = _safeTrim(options?.startDateYMD || options?.dayKey) || _getMadridDayKey();
            const endDayKey = _safeTrim(options?.endDateYMD) || startDayKey;
            const dayKeys = _getDayKeysInRange(startDayKey, endDayKey, 31);
            if (!dayKeys) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "INVALID_DATE_RANGE", message: "Rango de fechas inválido o superior a 31 días." },
                    traceId,
                };
            }

            const monthKeys = [...new Set(dayKeys.map((dayKey) => dayKey.slice(0, 7)))];
            const monthResults = await Promise.all(monthKeys.map((monthKey) =>
                dalQuery(REGISTROS_COL)
                    .eq(F.RESOURCE_ID, ctx.resourceId)
                    .eq(F.MONTH_KEY, monthKey)
                    .ascending(F.RECORDED_AT)
                    .limit(1000)
                    .find()
            ));
            if (monthResults.some((result) => typeof result?.hasNext === "function" && result.hasNext())) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TIMECLOCK_DATASET_LIMIT_EXCEEDED", message: "El rango supera el límite de lectura segura." },
                    traceId,
                };
            }

            const fichajes = monthResults
                .flatMap((result) => result?.items || [])
                .filter((record) => record[F.DAY_KEY] >= startDayKey && record[F.DAY_KEY] <= endDayKey)
                .sort((a, b) => new Date(a[F.RECORDED_AT]) - new Date(b[F.RECORDED_AT]));

            const integrity = await _getTimeclockIntegrity(fichajes);
            if (!integrity.allVerified) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TIMECLOCK_INTEGRITY_UNVERIFIED",
                        message: "No se calculan horas sobre fichajes sin firma HMAC valida.",
                        details: { unverifiedCount: integrity.unverifiedCount },
                    },
                    traceId,
                };
            }

            const byDay = new Map();
            for (const record of fichajes) {
                const key = record[F.DAY_KEY];
                if (!byDay.has(key)) byDay.set(key, []);
                byDay.get(key).push(record);
            }

            let totalMinutosTrabajados = 0;
            let totalMinutosPausa = 0;
            let jornadasAbiertas = 0;

            for (const dayRecords of byDay.values()) {
                const sequence = _validateTimeclockSequence(dayRecords);
                if (!sequence.valid) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: { code: "TIMECLOCK_SEQUENCE_INVALID", message: "La secuencia de eventos de jornada es inconsistente y requiere revision." },
                        traceId,
                    };
                }
                let minutosTrabajados = 0;
                let minutosPausaJornada = 0;
                let entradaTs = null;
                let pausaInicioTs = null;

                for (const record of dayRecords) {
                    const tipo = record[F.CLOCK_EVENT_TYPE];
                    const ts = new Date(record[F.RECORDED_AT]).getTime();

                    if (tipo === CLOCK_EVENT_TYPE.ENTRADA) {
                        entradaTs = ts;
                        pausaInicioTs = null;
                        minutosPausaJornada = 0;
                    } else if (tipo === CLOCK_EVENT_TYPE.PAUSA_INICIO && entradaTs !== null && pausaInicioTs === null) {
                        pausaInicioTs = ts;
                    } else if (tipo === CLOCK_EVENT_TYPE.PAUSA_FIN && pausaInicioTs !== null) {
                        minutosPausaJornada += Math.max(0, (ts - pausaInicioTs) / 60000);
                        pausaInicioTs = null;
                    } else if (tipo === CLOCK_EVENT_TYPE.SALIDA && entradaTs !== null) {
                        totalMinutosPausa += minutosPausaJornada;
                        minutosTrabajados += (ts - entradaTs) / 60000 - minutosPausaJornada;
                        entradaTs = null;
                        minutosPausaJornada = 0;
                    }
                }

                if (entradaTs !== null) jornadasAbiertas += 1;
                totalMinutosTrabajados += minutosTrabajados;
            }

            const minutosTrabajadosRedondeados = Math.max(0, Math.round(totalMinutosTrabajados));
            const minutosPausaRedondeados = Math.max(0, Math.round(totalMinutosPausa));
            return {
                status: "OK",
                data: {
                    dayKey: startDayKey === endDayKey ? startDayKey : null,
                    startDateYMD: startDayKey,
                    endDateYMD: endDayKey,
                    minutosTrabajados: minutosTrabajadosRedondeados,
                    horasTrabajadas: (minutosTrabajadosRedondeados / 60).toFixed(2),
                    minutosPausa: minutosPausaRedondeados,
                    horasPausa: (minutosPausaRedondeados / 60).toFixed(2),
                    totalFichajesProcesados: fichajes.length,
                    diasProcesados: dayKeys.length,
                    jornadasAbiertas,
                    jornadaCerrada: jornadasAbiertas === 0,
                    integrityStatus: "VERIFIED",
                },
                traceId,
            };
        } catch (error) {
            log.error("calcularHorasTrabajadas failed", { traceId, message: String(error) });
            return { status: "ERROR", data: null, error: { code: "INTERNAL" }, traceId };
        }
    }
);

export const getHistorialFichajes = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("hist-fichajes");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return { status: "ERROR", data: null, error: { code: "NOT_STAFF" } };
            }

            const startDateYMD = _safeTrim(options?.startDateYMD);
            const endDateYMD = _safeTrim(options?.endDateYMD);
            let rawItems = [];

            if (startDateYMD || endDateYMD) {
                const start = startDateYMD || endDateYMD;
                const end = endDateYMD || startDateYMD;
                const dayKeys = _getDayKeysInRange(start, end, 92);
                if (!dayKeys) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: { code: "INVALID_DATE_RANGE", message: "Rango de historial inválido o superior a 92 días." },
                        traceId,
                    };
                }
                const limit = Math.min(Number(options?.limit) || 500, 500);
                const monthKeys = [...new Set(dayKeys.map((dayKey) => dayKey.slice(0, 7)))];
                const monthResults = await Promise.all(monthKeys.map((monthKey) =>
                    dalQuery(REGISTROS_COL)
                        .eq(F.RESOURCE_ID, ctx.resourceId)
                        .eq(F.MONTH_KEY, monthKey)
                        .descending(F.RECORDED_AT)
                        .limit(1000)
                        .find()
                ));
                if (monthResults.some((result) => typeof result?.hasNext === "function" && result.hasNext())) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: { code: "TIMECLOCK_DATASET_LIMIT_EXCEEDED", message: "El historial supera el límite de lectura segura." },
                        traceId,
                    };
                }
                rawItems = monthResults
                    .flatMap((result) => result?.items || [])
                    .filter((record) => record[F.DAY_KEY] >= start && record[F.DAY_KEY] <= end)
                    .sort((a, b) => new Date(b[F.RECORDED_AT]) - new Date(a[F.RECORDED_AT]));
                if (rawItems.length > limit) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: { code: "TIMECLOCK_HISTORY_LIMIT_EXCEEDED", message: "El historial supera el máximo de filas solicitado; reduce el rango." },
                        traceId,
                    };
                }
            } else {
                const limit = Math.min(Number(options?.limit) || 30, 100);
                let query = dalQuery(REGISTROS_COL)
                    .eq(F.RESOURCE_ID, ctx.resourceId);
                if (_safeTrim(options?.monthKey)) {
                    query = query.eq(F.MONTH_KEY, _safeTrim(options.monthKey));
                }
                const res = await query
                    .descending(F.RECORDED_AT)
                    .limit(limit)
                    .find();
                rawItems = res?.items || [];
            }

            // DTO whitelist: nunca signature/meta completos, nunca deviceIpAddress.
            // La integridad se expone como estado, sin filtrar el HMAC ni datos del dispositivo.
            const integrity = await _getTimeclockIntegrity(rawItems);
            const recordsByDay = new Map();
            for (const record of rawItems) {
                const key = record[F.DAY_KEY];
                if (!recordsByDay.has(key)) recordsByDay.set(key, []);
                recordsByDay.get(key).push(record);
            }
            const invalidSequenceDays = new Set();
            for (const [dayKey, dayRecords] of recordsByDay.entries()) {
                const ordered = dayRecords.sort((a, b) => new Date(a[F.RECORDED_AT]) - new Date(b[F.RECORDED_AT]));
                if (!_validateTimeclockSequence(ordered).valid) invalidSequenceDays.add(dayKey);
            }
            const items = rawItems.map((f, index) => ({
                registradoEn: f[F.RECORDED_AT],
                horaRegistrada: f[F.RECORDED_TIME],
                fichajeEventoTipo: f[F.CLOCK_EVENT_TYPE],
                registroTipo: f[F.RECORD_TYPE],
                diaClave: f[F.DAY_KEY],
                ajusteMotivo: f[F.ADJUSTMENT_REASON] || null,
                integrityStatus: integrity.verified[index] ? "VERIFIED" : "UNVERIFIED",
                sequenceStatus: invalidSequenceDays.has(f[F.DAY_KEY]) ? "INVALID" : "VALID",
            }));

            return { status: "OK", data: { items, total: items.length }, traceId };
        } catch (error) {
            log.error("getHistorialFichajes failed", { traceId, message: String(error) });
            return { status: "ERROR", data: null, error: { code: "INTERNAL" }, traceId };
        }
    }
);

export const registrarAjusteHorario = webMethod(
    Permissions.Admin,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("ajuste-horario");
        try {
            await requireAdmin(traceId);

            const adminCtx = await _resolveStaffContext(traceId);
            const targetResourceId = _safeTrim(options?.resourceId);
            const clockEventType = _safeTrim(options?.clockEventType).toUpperCase();
            const adjustmentReason = _safeTrim(
                options?.adjustmentReason || options?.motivo
            );
            const recordedAtStr = options?.recordedAt || options?.fechaHora;

            if (!targetResourceId) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "INVALID_RESOURCE", message: "resourceId del trabajador requerido" },
                };
            }

            assertValidEnum(clockEventType, CLOCK_EVENT_TYPE, "clockEventType");

            if (!adjustmentReason) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "SCHEMA_VIOLATION",
                        message: "adjustmentReason obligatorio en ajustes (RD 8/2019)",
                    },
                };
            }

            const staff = await findStaffByResourceId(targetResourceId, traceId);
            if (!staff) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "STAFF_NOT_FOUND", message: "Trabajador no encontrado" },
                };
            }

            const recordedAt = recordedAtStr ? new Date(recordedAtStr) : _getMadridNow();
            if (isNaN(recordedAt.getTime())) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "INVALID_DATE", message: "recordedAt inválido" },
                };
            }

            const dayKey = _getMadridDayKey(recordedAt);
            const monthKey = _getMadridMonthKey(recordedAt);
            const recordedTime = _getMadridTime(recordedAt);

            const siteMemberId = await getSiteMemberIdByContactId(staff.contactId, traceId);
            if (!siteMemberId) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "STAFF_MEMBER_ID_UNAVAILABLE",
                        message: "No se pudo verificar la identidad de miembro del trabajador",
                    },
                    traceId,
                };
            }

            const record = {
                [F.RESOURCE_ID]: targetResourceId,
                [F.MEMBER_ID]: siteMemberId,
                [F.STAFF_NAME]: getStaffDisplayName(staff),
                [F.RECORDED_AT]: recordedAt,
                [F.RECORDED_TIME]: recordedTime,
                [F.DAY_KEY]: dayKey,
                [F.MONTH_KEY]: monthKey,
                [F.CLOCK_EVENT_TYPE]: clockEventType,
                [F.RECORD_TYPE]: RECORD_TYPE_HORARIOS.AJUSTE,
                [F.REGISTERED_BY]: CLOCK_REGISTERED_BY.MANAGER,
                [F.REGISTERED_BY_MEMBER_ID]: adminCtx?.memberId || null,
                [F.ADJUSTMENT_REASON]: adjustmentReason,
                [F.DEVICE_IP_ADDRESS]: null,
                [F.META]: { originalRequest: { resourceId: targetResourceId, clockEventType, recordedAt: recordedAtStr } },
                [F.TRACE_ID]: traceId,
            };

            record[F.SIGNATURE] = await signTimeclockRecord(record);
            assertRegistrosHorariosStaff(record);

            const saved = await insert(REGISTROS_COL, record);

            return {
                status: "OK",
                data: { id: saved._id, registradoEn: saved[F.RECORDED_AT] },
                traceId,
            };
        } catch (error) {
            log.error("registrarAjusteHorario failed", { traceId, message: String(error) });
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: error?.code === "ACCESS_DENIED" ? "ACCESS_DENIED" : "INTERNAL",
                    message: error?.message || "Error registrando ajuste",
                },
                traceId,
            };
        }
    }
);

export const getResumenHoras = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = _safeTrim(options?.traceId) || makeTraceId("resumen-horas");
        try {
            const ctx = await _resolveStaffContext(traceId);
            if (!ctx) {
                return { status: "ERROR", data: null, error: { code: "NOT_STAFF" } };
            }

            const monthKey = _safeTrim(options?.monthKey) || _getMadridMonthKey();

            const res = await dalQuery(REGISTROS_COL)
                .eq(F.RESOURCE_ID, ctx.resourceId)
                .eq(F.MONTH_KEY, monthKey)
                .ascending(F.RECORDED_AT)
                .limit(1000)
                .find();

            const fichajes = res?.items || [];
            const integrity = await _getTimeclockIntegrity(fichajes);
            if (!integrity.allVerified) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TIMECLOCK_INTEGRITY_UNVERIFIED",
                        message: "El resumen mensual requiere revision: hay fichajes sin firma HMAC valida.",
                        details: { unverifiedCount: integrity.unverifiedCount },
                    },
                    traceId,
                };
            }
            if (typeof res?.hasNext === "function" && res.hasNext()) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TIMECLOCK_DATASET_LIMIT_EXCEEDED", message: "El resumen mensual supera el limite de lectura segura." },
                    traceId,
                };
            }
            const porDia = {};
            let totalMinutos = 0;

            for (const f of fichajes) {
                const dk = f[F.DAY_KEY];
                if (!porDia[dk]) porDia[dk] = { minutos: 0, eventos: 0 };
                porDia[dk].eventos += 1;
            }

            // Calculo por dia
            for (const dk of Object.keys(porDia)) {
                const delDia = fichajes
                    .filter((f) => f[F.DAY_KEY] === dk)
                    .sort((a, b) => new Date(a[F.RECORDED_AT]) - new Date(b[F.RECORDED_AT]));

                let entradaTs = null;
                let pausaTs = null;
                let pausaMin = 0;
                let min = 0;

                for (const f of delDia) {
                    const tipo = f[F.CLOCK_EVENT_TYPE];
                    const ts = new Date(f[F.RECORDED_AT]).getTime();
                    if (tipo === CLOCK_EVENT_TYPE.ENTRADA) {
                        entradaTs = ts;
                        pausaMin = 0;
                    } else if (tipo === CLOCK_EVENT_TYPE.PAUSA_INICIO) {
                        pausaTs = ts;
                    } else if (tipo === CLOCK_EVENT_TYPE.PAUSA_FIN && pausaTs) {
                        pausaMin += (ts - pausaTs) / 60000;
                        pausaTs = null;
                    } else if (tipo === CLOCK_EVENT_TYPE.SALIDA && entradaTs) {
                        min += (ts - entradaTs) / 60000 - pausaMin;
                        entradaTs = null;
                        pausaMin = 0;
                    }
                }
                porDia[dk].minutos = Math.max(0, Math.round(min));
                totalMinutos += porDia[dk].minutos;
            }

            return {
                status: "OK",
                data: {
                    monthKey,
                    totalMinutos,
                    totalHoras: (totalMinutos / 60).toFixed(2),
                    diasTrabajados: Object.keys(porDia).filter((d) => porDia[d].minutos > 0).length,
                    detalle: porDia,
                },
                traceId,
            };
        } catch (error) {
            log.error("getResumenHoras failed", { traceId, message: String(error) });
            return { status: "ERROR", data: null, error: { code: "INTERNAL" }, traceId };
        }
    }
);
