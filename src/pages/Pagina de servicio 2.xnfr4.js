/**
 * MODULE: pages/servicio-2.js
 * VERSION: v5018-HARDENED
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
    "servicio-2"
]);

const MAX_ADDONS_PER_BOOKING =
    Number(BOOKINGS_ADDON_CONFIG?.MAX_POR_RESERVA) || 5;

let bridge = null;
let resolvedService = null;
let purchaseInProgress = false;

function text(value, fallback = "") {
    return _safeTrim(value) || fallback;
}

function showError(message) {
    const safeMessage = text(message, "No se pudo cargar el servicio.");

    console.error("[servicio-2] Error:", safeMessage);

    try {
        const banner = $w("#errorBanner");

        if (!banner) return;

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

function bridgeError(code, message, traceId, detail = null) {
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
        showError("No se pudo conectar el componente de reserva. Recarga la página.");
        return;
    }

    showError(detail?.cause?.message || message);
}

function serviceLookupError(result) {
    const code =
        result?.error?.code || "SERVICE_LOOKUP_FAILED";

    const message =
        result?.error?.message || "Servicio no encontrado.";

    const error = new Error(message);
    error.code = code;

    return error;
}

function getServiceId(service) {
    return text(service?.serviceId);
}

function getServiceSlug(service) {
    return _safeSlugOrId(service?.slug || "");
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
        throw new Error("La entrada de catálogo recibida no es válida.");
    }

    const catalogEntryType = text(
        data.catalogEntryType,
        "SERVICE"
    ).toUpperCase();

    const slug = getServiceSlug(data);

    if (!slug) {
        throw new Error("La entrada de catálogo no tiene un slug válido.");
    }

    if (!["SERVICE", "PRICING_PLAN"].includes(catalogEntryType)) {
        throw new Error("Tipo de catálogo no compatible.");
    }

    const common = {
        catalogEntryType,
        slug,
        title: text(data.title, "Servicio"),
        description: text(data.description),
        tagLine: text(data.tagLine),
        location: text(data.location),
        price: Math.max(0, toFiniteNumber(data.price)),
        currency: /^[A-Z]{3}$/.test(
            text(data.currency, "EUR").toUpperCase()
        )
            ? text(data.currency, "EUR").toUpperCase()
            : "EUR",
        mainMedia: data.mainMedia || "",
        recommendations: Array.isArray(data.recommendations)
            ? data.recommendations
            : [],
        clientHidden: data.clientHidden === true
    };

    if (catalogEntryType === "PRICING_PLAN") {
        const pricingPlanId = text(data.pricingPlanId);
        const sessionCount = Number(data.sessionCount);

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
        addOnOptions: Array.isArray(data.addOnOptions)
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

    for (const candidate of [
        query?.slug,
        query?.serviceId
    ]) {
        const value = _safeSlugOrId(candidate);

        if (value) {
            return value;
        }
    }

    const path = await location.path();
    const lastPathValue = path?.[path.length - 1] || "";
    const value = _safeSlugOrId(lastPathValue);

    if (
        !value ||
        EXCLUDED_PATHS.has(value.toLowerCase())
    ) {
        return null;
    }

    return value;
}

function getAllowedAddOnIds(service) {
    const options = Array.isArray(service?.addOnOptions)
        ? service.addOnOptions
        : [];

    return new Set(
        options
            .map(getAddonId)
            .filter(Boolean)
    );
}

function getValidatedAddOnIds(payload, service) {
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

    const allowedIds = getAllowedAddOnIds(service);

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

    if (requestedIds.length > MAX_ADDONS_PER_BOOKING) {
        const error = new Error(
            "Se ha superado el número máximo de complementos."
        );

        error.code = "TOO_MANY_ADDONS";
        throw error;
    }

    return requestedIds;
}

function buildBookingUrl(service, payload) {
    if (
        service.catalogEntryType !== "SERVICE" ||
        !_looksLikeGuid(getServiceId(service))
    ) {
        throw new Error(
            "Solo los servicios reservables pueden abrir el calendario de citas."
        );
    }

    const base = text(
        URLS?.CALENDARIO_2,
        "/booking-calendar/calendario-2"
    );

    const query = new URLSearchParams({
        slug: getServiceSlug(service),
        serviceId: getServiceId(service),
        referral: "servicio-2"
    });

    const addOnIds = getValidatedAddOnIds(
        payload,
        service
    );

    if (addOnIds.length > 0) {
        query.set("addOnIds", addOnIds.join(","));
    }

    return `${base}?${query.toString()}`;
}

function getServicesUrl() {
    return text(
        URLS?.SERVICIOS,
        "/reserva-online"
    );
}

async function loadService(lookupValue, traceId) {
    const result = await getServiceBySlugOrId(lookupValue);

    if (
        !result ||
        result.status !== "SUCCESS" ||
        !result.data ||
        typeof result.data !== "object"
    ) {
        throw serviceLookupError(result);
    }

    const service = normalizeCatalogEntry(result.data);

    console.info("[servicio-2] Servicio cargado", {
        traceId,
        serviceId: service.serviceId,
        slug: service.slug,
        catalogEntryType: service.catalogEntryType
    });

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
                message: "Ya hay una compra en curso."
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
            purchase?.order?._id || purchase?._id
        );

        if (!purchase || !orderId) {
            throw new Error(
                "La compra no devolvió una confirmación válida."
            );
        }

        console.info("[servicio-2] Compra de plan iniciada", {
            traceId,
            pricingPlanId: service.pricingPlanId,
            orderId
        });

        reply(MESSAGE_TYPES.BOOK, {
            status: "SUCCESS",
            data: {
                catalogEntryType: "PRICING_PLAN",
                title: service.title,
                sessionCount: service.sessionCount,
                orderId
            }
        });
    } catch (error) {
        console.warn(
            "[servicio-2] No se pudo completar la compra del plan",
            {
                traceId,
                pricingPlanId: service.pricingPlanId,
                code: text(
                    error?.code,
                    "PRICING_PLAN_PURCHASE_FAILED"
                )
            }
        );

        reply(MESSAGE_TYPES.BOOK, {
            status: "ERROR",
            error: {
                code: "PRICING_PLAN_PURCHASE_FAILED",
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
    const traceId = makeTraceId("servicio");

    let widget;

    try {
        widget = $w("#htmlWidgetCustomService");
    } catch (error) {
        showError("El widget del servicio no está disponible.");
        return;
    }

    if (
        !widget ||
        typeof widget.postMessage !== "function" ||
        typeof widget.onMessage !== "function"
    ) {
        showError("El widget del servicio no está disponible.");
        return;
    }

    let lookupValue;

    try {
        lookupValue = await resolveServiceLookup();
    } catch (error) {
        console.error(
            "[servicio-2] Error resolviendo la URL",
            {
                traceId,
                code: error?.code,
                message: error?.message
            }
        );

        showError(
            "No se pudo interpretar la dirección del servicio."
        );

        return;
    }

    if (!lookupValue) {
        showError(
            "No se pudo localizar el servicio en la URL."
        );

        return;
    }

    try {
        bridge = createWidgetBridge(widget, {
            traceId,
            allowOpaqueOrigin: true,

            onContextReady: async () => {
                resolvedService = await loadService(
                    lookupValue,
                    traceId
                );

                return resolvedService;
            },

            onWidgetMessage: async (message, reply) => {
                const type = _getMessageType(message);

                if (
                    type === MESSAGE_TYPES.READY ||
                    type === MESSAGE_TYPES.CONTEXT
                ) {
                    return;
                }

                const payload = _getPayload(message);

                if (!resolvedService) {
                    if (type === MESSAGE_TYPES.BOOK) {
                        reply(MESSAGE_TYPES.BOOK, {
                            status: "ERROR",
                            error: {
                                code: "SERVICE_NOT_READY",
                                message:
                                    "El servicio aún se está cargando."
                            }
                        });
                    }

                    return;
                }

                if (type === MESSAGE_TYPES.BOOK) {
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

                        await location.to(bookingUrl);
                    } catch (error) {
                        console.warn(
                            "[servicio-2] Selección de reserva inválida",
                            {
                                traceId,
                                code: error?.code,
                                message: error?.message
                            }
                        );

                        reply(MESSAGE_TYPES.BOOK, {
                            status: "ERROR",
                            error: {
                                code:
                                    error?.code ||
                                    "BOOKING_NAVIGATION_FAILED",
                                message:
                                    "No se pudo abrir la reserva."
                            }
                        });
                    }

                    return;
                }

                if (type === MESSAGE_TYPES.NAV) {
                    const target = text(
                        payload?.target
                    ).toUpperCase();

                    if (
                        !target ||
                        target === "SERVICIOS"
                    ) {
                        await location.to(
                            getServicesUrl()
                        );
                    }
                }
            },

            onError: (error, detail) => {
                bridgeError(
                    error?.code,
                    error?.message,
                    traceId,
                    detail
                );
            }
        });

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
