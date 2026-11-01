/**
 * MODULE: pages/servicio-2.js
 * VERSION: v5020-STRICT-ASCII-SERVICE-LOOKUP
 */

import { location } from "@wix/site-location";
import { checkout } from "@wix/site-pricing-plans";
import { getServiceBySlugOrId } from "backend/reservas.web.js";

import {
    MESSAGE_TYPES,
    URLS,
    BOOKINGS_ADDON_CONFIG,
    makeTraceId,
    _safeTrim,
    _safeSlugOrId,
    _looksLikeGuid,
    toFiniteNumber,
    _getMessageType,
    _getPayload
} from "public/mmUtils";

import { createWidgetBridge } from "public/widgetBridge";

const EXCLUDED_PATHS = new Set([
    "servicios",
    "service",
    "servicio",
    "servicio-2",
    "service-page"
]);

const MAX_ADDONS_PER_BOOKING =
    Number(BOOKINGS_ADDON_CONFIG?.MAX_POR_RESERVA) || 5;

let bridge = null;
let resolvedService = null;
let purchaseInProgress = false;

function text(value, fallback = "") {
    return _safeTrim(value) || fallback;
}

function decodeUrlValue(value) {
    const raw = _safeTrim(value || "");

    if (!raw) {
        return "";
    }

    try {
        return decodeURIComponent(raw).normalize("NFC");
    } catch (error) {
        console.warn("[servicio-2] Valor URL inválido", {
            value: raw,
            message: error?.message
        });

        return raw.normalize("NFC");
    }
}

function normalizeLookupValue(value) {
    const decoded = decodeUrlValue(value);
    return _safeSlugOrId(decoded);
}

function showError(message) {
    const safeMessage = text(
        message,
        "No se pudo cargar el servicio."
    );

    console.error("[servicio-2] Error:", safeMessage);

    try {
        const banner = $w("#errorBanner");

        if (!banner) {
            return;
        }

        banner.text = `Error: ${safeMessage}`;

        if (typeof banner.show === "function") {
            banner.show();
        }
    } catch (error) {
        console.warn(
            "[servicio-2] No se pudo mostrar el error:",
            error?.message
        );
    }
}

function bridgeError(
    code,
    message,
    traceId,
    detail = null
) {
    console.error("[servicio-2] Error del bridge", {
        traceId,
        code,
        message,
        detail
    });

    if (
        code === "WIDGET_ORIGIN_OPAQUE_REJECTED" ||
        code === "WIDGET_ORIGIN_REJECTED"
    ) {
        showError(
            "No se pudo conectar el componente de reserva. Recarga la página."
        );
        return;
    }

    showError(
        detail?.cause?.message ||
        message ||
        "No se pudo cargar el servicio."
    );
}

function serviceLookupError(result) {
    const code =
        result?.error?.code ||
        "SERVICE_LOOKUP_FAILED";

    const message =
        result?.error?.message ||
        "Servicio no encontrado.";

    const error = new Error(message);
    error.code = code;

    return error;
}

function getServiceId(service) {
    return text(service?.serviceId);
}

function getServiceSlug(service) {
    return normalizeLookupValue(service?.slug || "");
}

function getAddonId(item) {
    if (typeof item === "string") {
        return text(item);
    }

    if (item && typeof item === "object") {
        return text(item.addonId);
    }

    return "";
}

function normalizeCatalogEntry(data) {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw new Error(
            "La entrada de catálogo recibida no es válida."
        );
    }

    const catalogEntryType = text(
        data.catalogEntryType,
        "SERVICE"
    ).toUpperCase();

    const slug = getServiceSlug(data);

    if (!slug) {
        throw new Error(
            "La entrada de catálogo no tiene un slug válido."
        );
    }

    if (
        !["SERVICE", "PRICING_PLAN"].includes(
            catalogEntryType
        )
    ) {
        throw new Error(
            "Tipo de catálogo no compatible."
        );
    }

    const common = {
        catalogEntryType,
        slug,
        title: text(data.title, "Servicio"),
        description: text(data.description),
        tagLine: text(data.tagLine),
        location: text(data.location),
        price: Math.max(
            0,
            toFiniteNumber(data.price)
        ),
        currency: /^[A-Z]{3}$/.test(
            text(data.currency, "EUR").toUpperCase()
        )
            ? text(data.currency, "EUR").toUpperCase()
            : "EUR",
        mainMedia: data.mainMedia || "",
        recommendations: Array.isArray(
            data.recommendations
        )
            ? data.recommendations
            : [],
        clientHidden: data.clientHidden === true
    };

    if (
        catalogEntryType === "PRICING_PLAN"
    ) {
        const pricingPlanId = text(
            data.pricingPlanId
        );

        const sessionCount = Number(
            data.sessionCount
        );

        if (!_looksLikeGuid(pricingPlanId)) {
            throw new Error(
                "El plan no tiene un identificador de Pricing Plans válido."
            );
        }

        if (
            !Number.isSafeInteger(sessionCount) ||
            sessionCount < 1
        ) {
            throw new Error(
                "El plan debe incluir un número válido de sesiones."
            );
        }

        return {
            ...common,
            pricingPlanId,
            sessionCount,
            serviceId: "",
            totalDuration: 0,
            addOnOptions: [],
            allowCombine: false,
            phase1Duration: 0,
            exposureDuration: 0,
            phase2Duration: 0,
            linkedPhases: "",
            primaryActionLabel: text(
                data.primaryActionLabel,
                "Comprar bono"
            )
        };
    }

    const serviceId = getServiceId(data);

    if (!_looksLikeGuid(serviceId)) {
        throw new Error(
            "El servicio no tiene un identificador válido."
        );
    }

    return {
        ...common,
        serviceId,
        pricingPlanId: "",
        sessionCount: 0,
        totalDuration: Math.max(
            0,
            toFiniteNumber(data.totalDuration)
        ),
        addOnOptions: Array.isArray(
            data.addOnOptions
        )
            ? data.addOnOptions
            : [],
        allowCombine: data.allowCombine === true,
        phase1Duration: Math.max(
            0,
            toFiniteNumber(data.phase1Duration)
        ),
        exposureDuration: Math.max(
            0,
            toFiniteNumber(data.exposureDuration)
        ),
        phase2Duration: Math.max(
            0,
            toFiniteNumber(data.phase2Duration)
        ),
        linkedPhases: text(data.linkedPhases),
        primaryActionLabel: text(
            data.primaryActionLabel,
            "Reservar cita"
        )
    };
}

async function resolveServiceLookup() {
    const query = await location.query();

    // Prefer the immutable Wix service GUID when both query params exist.
    // The slug is SEO/navigation metadata and may be stale after catalog edits.
    const queryServiceId = text(query?.serviceId);
    if (queryServiceId && _looksLikeGuid(queryServiceId)) {
        return queryServiceId.toLowerCase();
    }

    const querySlug = normalizeLookupValue(query?.slug);
    if (querySlug) {
        return querySlug;
    }

    const path = await location.path();

    const segments = Array.isArray(path)
        ? path
        : [];

    const lastSegment = normalizeLookupValue(
        segments[segments.length - 1]
    );

    if (!lastSegment) {
        return null;
    }

    const excludedValue = lastSegment
        .toLowerCase()
        .trim();

    if (EXCLUDED_PATHS.has(excludedValue)) {
        return null;
    }

    return lastSegment;
}

function getAllowedAddOnIds(service) {
    const options = Array.isArray(
        service?.addOnOptions
    )
        ? service.addOnOptions
        : [];

    return new Set(
        options
            .map(getAddonId)
            .filter(Boolean)
    );
}

function getValidatedAddOnIds(
    payload,
    service
) {
    if (!Array.isArray(payload?.addOnIds)) {
        return [];
    }

    const requestedIds = Array.from(
        new Set(
            payload.addOnIds
                .map(getAddonId)
                .filter(Boolean)
        )
    );

    if (
        requestedIds.length >
        MAX_ADDONS_PER_BOOKING
    ) {
        const error = new Error(
            "Se ha superado el número máximo de complementos."
        );

        error.code = "TOO_MANY_ADDONS";
        throw error;
    }

    const allowedIds =
        getAllowedAddOnIds(service);

    const invalidIds = requestedIds.filter(
        (id) => !allowedIds.has(id)
    );

    if (invalidIds.length > 0) {
        const error = new Error(
            "Uno o más complementos no están disponibles para este servicio."
        );

        error.code = "INVALID_ADDON_SELECTION";
        throw error;
    }

    return requestedIds;
}

function buildBookingUrl(service, payload) {
    if (
        service.catalogEntryType !== "SERVICE" ||
        !_looksLikeGuid(
            getServiceId(service)
        )
    ) {
        throw new Error(
            "Solo los servicios reservables pueden abrir el calendario de citas."
        );
    }

    // La ruta nativa de Bookings identifica el servicio por su slug público.
    // No usar la página fija "calendario-2" ni duplicar slug/serviceId en query.
    const slug = getServiceSlug(service);
    if (!slug) {
        throw new Error("El servicio no tiene un slug público válido.");
    }

    const base = `/booking-calendar/${encodeURIComponent(slug)}`;
    const query = new URLSearchParams({
        referral: "service_list_widget"
    });

    const addOnIds =
        getValidatedAddOnIds(
            payload,
            service
        );

    if (addOnIds.length > 0) {
        query.set(
            "addOnIds",
            addOnIds.join(",")
        );
    }

    return `${base}?${query.toString()}`;
}

function getServicesUrl() {
    return text(
        URLS?.SERVICIOS,
        "/reserva-online"
    );
}

async function loadService(
    lookupValue,
    traceId
) {
    const normalizedLookup =
        normalizeLookupValue(
            lookupValue
        );

    if (!normalizedLookup) {
        throw serviceLookupError({
            error: {
                code: "EMPTY_SERVICE_LOOKUP",
                message:
                    "No se recibió el identificador del servicio."
            }
        });
    }

    const result =
        await getServiceBySlugOrId(
            normalizedLookup
        );

    if (
        !result ||
        result.status !== "SUCCESS" ||
        !result.data ||
        typeof result.data !== "object"
    ) {
        throw serviceLookupError(result);
    }

    const service =
        normalizeCatalogEntry(
            result.data
        );

    console.info(
        "[servicio-2] Servicio cargado",
        {
            traceId,
            lookupValue: normalizedLookup,
            serviceId: service.serviceId,
            slug: service.slug,
            catalogEntryType:
                service.catalogEntryType
        }
    );

    return service;
}

async function handlePricingPlanPurchase(
    service,
    traceId,
    reply
) {
    if (purchaseInProgress) {
        reply(MESSAGE_TYPES.BOOK, {
            status: "ERROR",
            error: {
                code: "PURCHASE_IN_PROGRESS",
                message:
                    "Ya hay una compra en curso."
            }
        });

        return;
    }

    purchaseInProgress = true;

    try {
        const purchase =
            await checkout.startOnlinePurchase(
                service.pricingPlanId
            );

        const orderId = text(
            purchase?.order?._id ||
            purchase?._id
        );

        if (!purchase || !orderId) {
            throw new Error(
                "La compra no devolvió una confirmación válida."
            );
        }

        console.info(
            "[servicio-2] Compra de plan iniciada",
            {
                traceId,
                pricingPlanId:
                    service.pricingPlanId,
                orderId
            }
        );

        reply(MESSAGE_TYPES.BOOK, {
            status: "SUCCESS",
            data: {
                catalogEntryType:
                    "PRICING_PLAN",
                title: service.title,
                sessionCount:
                    service.sessionCount,
                orderId
            }
        });
    } catch (error) {
        console.warn(
            "[servicio-2] Fallo en compra de plan",
            {
                traceId,
                pricingPlanId:
                    service.pricingPlanId,
                code: text(
                    error?.code,
                    "PRICING_PLAN_PURCHASE_FAILED"
                )
            }
        );

        reply(MESSAGE_TYPES.BOOK, {
            status: "ERROR",
            error: {
                code:
                    "PRICING_PLAN_PURCHASE_FAILED",
                message:
                    "No se ha podido completar la compra. Inténtalo de nuevo."
            }
        });

        showError(
            "No se ha podido completar la compra del bono. Inténtalo de nuevo."
        );
    } finally {
        purchaseInProgress = false;
    }
}

$w.onReady(async () => {
    const traceId = makeTraceId(
        "servicio"
    );

    let widget;

    try {
        widget = $w(
            "#htmlWidgetCustomService"
        );
    } catch (error) {
        showError(
            "El widget del servicio no está disponible."
        );
        return;
    }

    if (
        !widget ||
        typeof widget.postMessage !==
            "function" ||
        typeof widget.onMessage !==
            "function"
    ) {
        showError(
            "El widget del servicio no está disponible."
        );
        return;
    }

    try {
        // Instalar el listener antes de resolver URL/CMS evita perder MM_READY.
        bridge = createWidgetBridge(
            widget,
            {
                traceId,
                allowOpaqueOrigin: true,
                handshakeTimeoutMs: 45000,
                contextTimeoutMs: 120000,
                contextAttemptTimeoutMs: 30000,

                onContextReady: async () => {
                    let lookupValue;
                    try {
                        lookupValue = await resolveServiceLookup();
                    } catch (error) {
                        error.code = error.code || "SERVICE_URL_RESOLUTION_FAILED";
                        throw error;
                    }

                    if (!lookupValue) {
                        const error = new Error("No se pudo localizar el servicio en la URL.");
                        error.code = "SERVICE_IDENTIFIER_MISSING";
                        throw error;
                    }

                    resolvedService = await loadService(lookupValue, traceId);
                    return resolvedService;
                },

                onWidgetMessage: async (
                    message,
                    reply
                ) => {
                    const type =
                        _getMessageType(
                            message
                        );

                    if (
                        type ===
                            MESSAGE_TYPES.READY ||
                        type ===
                            MESSAGE_TYPES.CONTEXT
                    ) {
                        return;
                    }

                    const payload =
                        _getPayload(
                            message
                        );

                    if (!resolvedService) {
                        if (
                            type ===
                            MESSAGE_TYPES.BOOK
                        ) {
                            reply(
                                MESSAGE_TYPES.BOOK,
                                {
                                    status:
                                        "ERROR",
                                    error: {
                                        code:
                                            "SERVICE_NOT_READY",
                                        message:
                                            "El servicio aún se está cargando."
                                    }
                                }
                            );
                        }

                        return;
                    }

                    if (
                        type ===
                        MESSAGE_TYPES.BOOK
                    ) {
                        if (
                            resolvedService.catalogEntryType ===
                            "PRICING_PLAN"
                        ) {
                            await handlePricingPlanPurchase(
                                resolvedService,
                                traceId,
                                reply
                            );

                            return;
                        }

                        try {
                            const bookingUrl =
                                buildBookingUrl(
                                    resolvedService,
                                    payload
                                );

                            await location.to(
                                bookingUrl
                            );
                        } catch (error) {
                            console.warn(
                                "[servicio-2] Reserva inválida",
                                {
                                    traceId,
                                    code:
                                        error?.code,
                                    message:
                                        error?.message
                                }
                            );

                            reply(
                                MESSAGE_TYPES.BOOK,
                                {
                                    status:
                                        "ERROR",
                                    error: {
                                        code:
                                            error?.code ||
                                            "BOOKING_NAVIGATION_FAILED",
                                        message:
                                            "No se pudo abrir la reserva."
                                    }
                                }
                            );
                        }

                        return;
                    }

                    if (
                        type ===
                        MESSAGE_TYPES.NAV
                    ) {
                        const target =
                            text(
                                payload?.target
                            ).toUpperCase();

                        if (
                            !target ||
                            target ===
                                "SERVICIOS"
                        ) {
                            await location.to(
                                getServicesUrl()
                            );
                        }
                    }
                },

                onError: (
                    error,
                    detail
                ) => {
                    bridgeError(
                        error?.code,
                        error?.message,
                        traceId,
                        detail
                    );
                }
            }
        );

        if (!bridge) {
            showError(
                "No se pudo inicializar el widget del servicio."
            );
        }
    } catch (error) {
        console.error(
            "[servicio-2] Error de inicialización",
            {
                traceId,
                code: error?.code,
                message: error?.message
            }
        );

        showError(
            error?.message ||
            "No se pudo cargar el servicio."
        );
    }
});
