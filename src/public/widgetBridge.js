/**
 * MODULE: public/widgetBridge.js
 * VERSION: v5013-CLEAN
 * APIS: TextEncoder, URL.
 * DOC: https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder
 *      https://developer.mozilla.org/en-US/docs/Web/API/URL
 *
 * CONTEXTO WIX: HTML Components en iframes sandboxed → origin opaco ("", "null").
 * Solución: allowOpaqueOrigin: true (relajación mínima; origins no opacos
 * siguen validados por sufijo).
 */
export const PROTOCOL_VERSION = 1;
export const MESSAGE_TYPES = Object.freeze({
    READY: "MM_READY", CONTEXT: "MM_CONTEXT", AVAIL: "MM_AVAIL",
    SELECT: "MM_SELECT", BOOK: "MM_BOOK", NAV: "MM_NAV"
});
export const PROTOCOL_URLS = Object.freeze({
    SERVICIOS: "/reserva-online",
    CALENDARIO_2: "/booking-calendar/calendario-2",
    PRIVACY_POLICY: "/politica-de-privacidad"
});
export const PROTOCOL_UI = Object.freeze({
    FRONTEND_API_TIMEOUT_MS: 210000,
    HANDSHAKE_TIMEOUT_MS: 30000,
    CONTEXT_TIMEOUT_MS: 120000,
    CONTEXT_ATTEMPT_TIMEOUT_MS: 30000,
    CONTEXT_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 500,
    RETRY_MAX_DELAY_MS: 4000
});
const RESPONSE_TYPE_SUFFIX = "_RES";
const RESPONSE_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{0,38}_RES$/;
const ADMIN_RESPONSE_TYPE = "MM_ADMIN_RESPONSE";
const MAX_TYPE_LENGTH = 40;
const MAX_MESSAGE_ID_LENGTH = 120;
const MAX_MESSAGE_BYTES = 100000;
const MAX_PAYLOAD_KEYS = 400;
const DEFAULT_ALLOWED_ORIGIN_SUFFIXES = Object.freeze([".parastorage.com", ".wix.com", ".wixsite.com", ".editorx.com"]);
const OPAQUE_ORIGIN_PREFIXES = Object.freeze(["blob:", "data:", "filesystem:"]);
export const WIDGET_ERROR_CODE = Object.freeze({
    INVALID_WIDGET: "WIDGET_INVALID_HTML_COMPONENT",
    DESTROYED: "WIDGET_BRIDGE_DESTROYED",
    ORIGIN_REJECTED: "WIDGET_ORIGIN_REJECTED",
    ORIGIN_OPAQUE_REJECTED: "WIDGET_ORIGIN_OPAQUE_REJECTED",
    MESSAGE_TOO_LARGE: "WIDGET_MESSAGE_TOO_LARGE",
    PAYLOAD_TOO_COMPLEX: "WIDGET_PAYLOAD_TOO_COMPLEX",
    TYPE_MISSING: "WIDGET_MESSAGE_TYPE_MISSING",
    TYPE_NOT_ALLOWED: "WIDGET_MESSAGE_TYPE_NOT_ALLOWED",
    VERSION_UNSUPPORTED: "WIDGET_PROTOCOL_VERSION_UNSUPPORTED",
    MESSAGE_REJECTED: "WIDGET_MESSAGE_REJECTED",
    MESSAGE_ID_INVALID: "WIDGET_MESSAGE_ID_INVALID",
    HANDSHAKE_TIMEOUT: "WIDGET_HANDSHAKE_TIMEOUT",
    CONTEXT_TIMEOUT: "WIDGET_CONTEXT_TIMEOUT",
    CONTEXT_FAILED: "WIDGET_CONTEXT_FAILED",
    LISTENER_FAILED: "WIDGET_MESSAGE_LISTENER_FAILED",
    HANDLER_FAILED: "WIDGET_MESSAGE_HANDLER_FAILED",
    CONSUMER_ERROR_HANDLER_FAILED: "WIDGET_ERROR_HANDLER_FAILED"
});
const DEFAULT_ALLOWED_TYPES = Object.freeze(Object.values(MESSAGE_TYPES));
const textEncoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
let instanceCounter = 0;

function safeObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function safeType(value) { return String(value ?? "").trim().toUpperCase().slice(0, MAX_TYPE_LENGTH); }
function safeMessageId(value) {
    const n = String(value ?? "").trim();
    if (!n || n.length > MAX_MESSAGE_ID_LENGTH || !/^[a-zA-Z0-9._:-]+$/.test(n)) return "";
    return n;
}
function toProtocolVersion(value) {
    if (value === undefined || value === null || value === "") return PROTOCOL_VERSION;
    const p = Number(value);
    return Number.isInteger(p) && p > 0 ? p : null;
}
function estimateBytes(value) {
    try {
        const s = JSON.stringify(value);
        if (typeof s !== "string") return MAX_MESSAGE_BYTES + 1;
        return textEncoder ? textEncoder.encode(s).length : s.length;
    } catch (_) { return MAX_MESSAGE_BYTES + 1; }
}
function countKeys(value) {
    if (!value || typeof value !== "object") return 0;
    let total = 0; const stack = [value];
    while (stack.length > 0 && total <= MAX_PAYLOAD_KEYS) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        const keys = Object.keys(cur); total += keys.length;
        for (const key of keys) { const child = cur[key]; if (child && typeof child === "object") stack.push(child); }
    }
    return total;
}
function isResponseType(type) { return RESPONSE_TYPE_PATTERN.test(type); }
function getResponseTypeBase(type) { return isResponseType(type) ? type.slice(0, -RESPONSE_TYPE_SUFFIX.length) : ""; }
function normalizeOriginSuffix(value) {
    const s = String(value ?? "").trim().toLowerCase().replace(/^\.+/, "");
    return s ? `.${s}` : "";
}
function resolveOriginPolicy(options) {
    const exact = String(options.allowedOrigin ?? "").trim().toLowerCase().replace(/\/$/, "");
    if (exact) return Object.freeze({ mode: "exact", exact, suffixes: Object.freeze([]), allowOpaqueOrigin: options.allowOpaqueOrigin === true });
    const custom = Array.isArray(options.allowedOriginSuffixes) ? options.allowedOriginSuffixes.map(normalizeOriginSuffix).filter(Boolean) : [];
    return Object.freeze({
        mode: options.strictOrigin === false ? "off" : "suffix",
        exact: "",
        suffixes: Object.freeze(custom.length > 0 ? custom : DEFAULT_ALLOWED_ORIGIN_SUFFIXES),
        allowOpaqueOrigin: options.allowOpaqueOrigin === true
    });
}
function classifyOrigin(rawOrigin) {
    const origin = String(rawOrigin ?? "").trim().toLowerCase();
    if (!origin || origin === "null") return { opaque: true, value: origin };
    return { opaque: OPAQUE_ORIGIN_PREFIXES.some((p) => origin.startsWith(p)), value: origin };
}
function getOriginHost(origin) {
    try { return new URL(origin).hostname.toLowerCase(); }
    catch (_) { return origin.replace(/^[a-z0-9+.-]+:\/\//i, "").split("/")[0].toLowerCase(); }
}
function isOriginAllowed(origin, policy) {
    if (policy.mode === "off") return true;
    if (policy.mode === "exact") return origin === policy.exact;
    const host = getOriginHost(origin);
    return policy.suffixes.some((suffix) => { const base = suffix.slice(1); return host === base || host.endsWith(suffix); });
}
function withManagedTimeout(promise, timeoutMs, code, timers) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true; timers.delete(timer);
            const error = new Error(code); error.code = code; reject(error);
        }, Math.max(1, Number(timeoutMs) || 1));
        timers.add(timer);
        Promise.resolve(promise).then(
            (v) => { if (settled) return; settled = true; clearTimeout(timer); timers.delete(timer); resolve(v); },
            (e) => { if (settled) return; settled = true; clearTimeout(timer); timers.delete(timer); reject(e); }
        );
    });
}

export function createWidgetBridge(widgetElement, options = {}) {
    if (!widgetElement || typeof widgetElement.onMessage !== "function" || typeof widgetElement.postMessage !== "function") {
        const error = new TypeError(WIDGET_ERROR_CODE.INVALID_WIDGET);
        error.code = WIDGET_ERROR_CODE.INVALID_WIDGET; throw error;
    }
    const settings = safeObject(options);
    instanceCounter += 1;
    const bridgeId = `wbridge-${instanceCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const originPolicy = resolveOriginPolicy(settings);
    const allowedTypes = new Set(
        Array.isArray(settings.allowedTypes) && settings.allowedTypes.length > 0
            ? settings.allowedTypes.map(safeType).filter(Boolean)
            : DEFAULT_ALLOWED_TYPES
    );
    const handshakeTimeoutMs = Number(settings.handshakeTimeoutMs) > 0 ? Number(settings.handshakeTimeoutMs) : PROTOCOL_UI.HANDSHAKE_TIMEOUT_MS;
    const contextTimeoutMs = Number(settings.contextTimeoutMs) > 0 ? Number(settings.contextTimeoutMs) : PROTOCOL_UI.CONTEXT_TIMEOUT_MS;
    const contextAttemptTimeoutMs = Number(settings.contextAttemptTimeoutMs) > 0 ? Number(settings.contextAttemptTimeoutMs) : PROTOCOL_UI.CONTEXT_ATTEMPT_TIMEOUT_MS;
    const onWidgetMessage = typeof settings.onWidgetMessage === "function" ? settings.onWidgetMessage : null;
    const onContextReady = typeof settings.onContextReady === "function" ? settings.onContextReady : null;
    const onError = typeof settings.onError === "function" ? settings.onError : () => {};
    let destroyed = false, sequence = 0, handshakeCompleted = false, contextInFlight = false, bridge = null, handshakeTimer = null;
    const listeners = new Set(), timers = new Set();

    function isAllowedType(type) {
        if (allowedTypes.has(type) || type === ADMIN_RESPONSE_TYPE) return true;
        const base = getResponseTypeBase(type);
        return Boolean(base) && allowedTypes.has(base);
    }
    function reportError(code, detail = null, cause = null) {
        const error = new Error(code); error.code = code; error.bridgeId = bridgeId;
        if (cause) error.cause = cause;
        if (detail !== null && detail !== undefined) error.detail = detail;
        try { onError(error, detail); } catch (_) { /* no romper entrega */ }
        return error;
    }
    function clearAllTimers() { timers.forEach((t) => clearTimeout(t)); timers.clear(); handshakeTimer = null; }

    function extractEvent(event) {
        const classified = classifyOrigin(event?.origin);
        if (classified.opaque) {
            if (!originPolicy.allowOpaqueOrigin) { reportError(WIDGET_ERROR_CODE.ORIGIN_OPAQUE_REJECTED, { origin: classified.value }); return null; }
            // Expected for opted-in sandboxed Wix HTML Components; keep all message validation.
        } else if (originPolicy.mode !== "off" && !isOriginAllowed(classified.value, originPolicy)) {
            reportError(WIDGET_ERROR_CODE.ORIGIN_REJECTED, { origin: classified.value }); return null;
        }
        const message = safeObject(event?.data);
        if (estimateBytes(message) > MAX_MESSAGE_BYTES) { reportError(WIDGET_ERROR_CODE.MESSAGE_TOO_LARGE); return null; }
        if (countKeys(message) > MAX_PAYLOAD_KEYS) { reportError(WIDGET_ERROR_CODE.PAYLOAD_TOO_COMPLEX); return null; }
        return message;
    }
    function normalizeMessage(source) {
        const type = safeType(source.type);
        if (!type) return { message: null, code: WIDGET_ERROR_CODE.TYPE_MISSING };
        if (!isAllowedType(type)) return { message: null, code: WIDGET_ERROR_CODE.TYPE_NOT_ALLOWED };
        const version = toProtocolVersion(source.version);
        if (version !== PROTOCOL_VERSION) return { message: null, code: WIDGET_ERROR_CODE.VERSION_UNSUPPORTED };
        const messageId = safeMessageId(source.messageId);
        const requiresMessageId = type === MESSAGE_TYPES.AVAIL || type === MESSAGE_TYPES.BOOK || type === MESSAGE_TYPES.NAV;
        if (requiresMessageId && !messageId) return { message: null, code: WIDGET_ERROR_CODE.MESSAGE_ID_INVALID };
        return {
            message: Object.freeze({ type, payload: Object.freeze(safeObject(source.payload)), messageId, requestId: safeMessageId(source.requestId) || messageId, version: PROTOCOL_VERSION, bridgeId }),
            code: null
        };
    }
    function notifyListeners(message) {
        listeners.forEach((listener) => { try { listener(message, bridge); } catch (error) { reportError(WIDGET_ERROR_CODE.LISTENER_FAILED, null, error); } });
    }
    function nextMessageId() { sequence += 1; return safeMessageId(`${bridgeId}-${Date.now().toString(36)}-${sequence.toString(36)}`); }
    function send(type, payload = {}, messageId = null) {
        if (destroyed) { const e = new Error(WIDGET_ERROR_CODE.DESTROYED); e.code = WIDGET_ERROR_CODE.DESTROYED; throw e; }
        const normalizedType = safeType(type);
        if (!isAllowedType(normalizedType)) { const e = new Error(WIDGET_ERROR_CODE.TYPE_NOT_ALLOWED); e.code = WIDGET_ERROR_CODE.TYPE_NOT_ALLOWED; throw e; }
        const message = Object.freeze({ type: normalizedType, payload: safeObject(payload), messageId: safeMessageId(messageId) || nextMessageId(), version: PROTOCOL_VERSION, bridgeId });
        if (estimateBytes(message) > MAX_MESSAGE_BYTES) { const e = new Error(WIDGET_ERROR_CODE.MESSAGE_TOO_LARGE); e.code = WIDGET_ERROR_CODE.MESSAGE_TOO_LARGE; throw e; }
        widgetElement.postMessage(message); return message.messageId;
    }
    function resolveCorrelationId(requestMessage) {
        if (!requestMessage) return "";
        if (typeof requestMessage === "string") return safeMessageId(requestMessage);
        if (typeof requestMessage !== "object") return "";
        return safeMessageId(requestMessage.messageId) || safeMessageId(requestMessage.requestId);
    }
    function reply(type, payload = {}, requestMessage = null) { return send(type, payload, resolveCorrelationId(requestMessage) || null); }
    function postMessage(payload = {}, type = MESSAGE_TYPES.CONTEXT) { return send(type, payload); }
    async function publishContext(message) {
        if (!onContextReady || contextInFlight || destroyed) return;
        contextInFlight = true;
        try {
            const loadContextWithRetry = async () => {
                let lastError = null;
                for (let attempt = 1; attempt <= PROTOCOL_UI.CONTEXT_ATTEMPTS; attempt += 1) {
                    if (destroyed) return null;
                    try {
                        const context = await withManagedTimeout(
                            Promise.resolve().then(() => onContextReady(message, bridge)),
                            contextAttemptTimeoutMs,
                            WIDGET_ERROR_CODE.CONTEXT_TIMEOUT,
                            timers
                        );
                        if (context === undefined || context === null) {
                            const error = new Error(WIDGET_ERROR_CODE.CONTEXT_FAILED);
                            error.code = WIDGET_ERROR_CODE.CONTEXT_FAILED;
                            throw error;
                        }
                        return context;
                    } catch (cause) {
                        lastError = cause;
                        if (attempt >= PROTOCOL_UI.CONTEXT_ATTEMPTS || destroyed) throw cause;
                        const delayMs = Math.min(
                            PROTOCOL_UI.RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)),
                            PROTOCOL_UI.RETRY_MAX_DELAY_MS
                        );
                        try {
                            onError(Object.assign(new Error("WIDGET_CONTEXT_RETRY"), {
                                code: "WIDGET_CONTEXT_RETRY",
                                attempt,
                                nextAttempt: attempt + 1,
                                delayMs,
                                cause
                            }));
                        } catch (_) { /* el log no debe bloquear el reintento */ }
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                    }
                }
                throw lastError || new Error(WIDGET_ERROR_CODE.CONTEXT_FAILED);
            };
            const context = await withManagedTimeout(
                loadContextWithRetry(),
                contextTimeoutMs,
                WIDGET_ERROR_CODE.CONTEXT_TIMEOUT,
                timers
            );
            if (destroyed || context === undefined || context === null) return;
            send(MESSAGE_TYPES.CONTEXT, context, message.messageId || null);
        } catch (cause) {
            const code = cause?.code === WIDGET_ERROR_CODE.CONTEXT_TIMEOUT ? WIDGET_ERROR_CODE.CONTEXT_TIMEOUT : WIDGET_ERROR_CODE.CONTEXT_FAILED;
            reportError(code, { causeCode: cause?.code || null, causeMessage: cause?.message || String(cause), causeStack: cause?.stack || null }, cause);
        } finally { contextInFlight = false; }
    }
    function armHandshakeWatchdog() {
        if (!onContextReady || handshakeTimeoutMs <= 0) return;
        handshakeTimer = setTimeout(() => {
            timers.delete(handshakeTimer); handshakeTimer = null;
            if (destroyed || handshakeCompleted) return;
            reportError(WIDGET_ERROR_CODE.HANDSHAKE_TIMEOUT, { bridgeId });
        }, handshakeTimeoutMs);
        timers.add(handshakeTimer);
    }
    const unsubscribeWidget = widgetElement.onMessage((event) => {
        if (destroyed) return;
        try {
            const extracted = extractEvent(event); if (!extracted) return;
            const normalized = normalizeMessage(extracted);
            if (!normalized.message) { reportError(normalized.code || WIDGET_ERROR_CODE.MESSAGE_REJECTED, { receivedType: extracted.type ?? null, receivedVersion: extracted.version ?? null }); return; }
            const message = normalized.message;
            if (message.type === MESSAGE_TYPES.READY) { handshakeCompleted = true; if (handshakeTimer !== null) { clearTimeout(handshakeTimer); timers.delete(handshakeTimer); handshakeTimer = null; } }
            notifyListeners(message);
            if (onWidgetMessage) {
                const replyToMessage = (responseType, payload = {}, requestMessage = message) => {
                    const candidate = requestMessage && typeof requestMessage === "object" && (requestMessage.messageId || requestMessage.requestId) ? requestMessage : message;
                    return reply(responseType, payload, candidate);
                };
                Promise.resolve().then(() => onWidgetMessage(message, replyToMessage, bridge)).catch((error) => { reportError(error?.code || WIDGET_ERROR_CODE.HANDLER_FAILED, null, error); });
            }
            if (message.type === MESSAGE_TYPES.READY) void publishContext(message);
        } catch (error) { reportError(error?.code || WIDGET_ERROR_CODE.HANDLER_FAILED, null, error); }
    });
    armHandshakeWatchdog();
    bridge = Object.freeze({
        type: "WIX_HTML_COMPONENT_BRIDGE", bridgeId, protocolVersion: PROTOCOL_VERSION,
        widget: widgetElement, originPolicyMode: originPolicy.mode,
        allowedTypes: Object.freeze(Array.from(allowedTypes)),
        get destroyed() { return destroyed; },
        get handshakeCompleted() { return handshakeCompleted; },
        send, reply, postMessage,
        destroy() {
            if (destroyed) return;
            destroyed = true; listeners.clear(); clearAllTimers();
            if (typeof unsubscribeWidget === "function") { try { unsubscribeWidget(); } catch (_) {} }
        }
    });
    return bridge;
}
export default createWidgetBridge;