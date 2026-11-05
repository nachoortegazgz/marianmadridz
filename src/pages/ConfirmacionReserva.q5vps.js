/*
=============================================================================
MODULE: pages/ConfirmacionReserva.q5vps.js
VERSION: v1.4-NAV-TARGETS-MY-BOOKINGS
BASE: v1.3-HANDSHAKE-RACE-SAFE
RESPONSIBILITY: Mostrar confirmación de reserva tras éxito presencial u online.
STANDARDS: G10 ASCII Strict. Uso estricto de APIs Velo actuales.
CONTRATO: Recibe datos via lightbox.getContext(): { booking, bookingId, service, traceId }.
=============================================================================

CORRECCIONES v1.4:
  - CONF-11 (P0): navegación desde el HTML vía MM_NAV. El HTML envía
    { target: "MIS_RESERVAS" | "HOME" | "RESERVA_ONLINE" } (simbólico)
    y el Velo traduce a URL real usando URLS.* de mmUtils con fallback
    local /my-bookings (ruta real del sitio). Se conserva compatibilidad
    legacy con { url: "/..." } limitada a rutas conocidas. Elimina el
    fallback roto window.top.location.href del HTML.

CORRECCIONES v1.3:
  - CONF-08 (P0): race en el handshake HTML↔Velo. Si el HTML enviaba
    MM_CONFIRMATION_READY antes de que el Velo terminara de construir
    confirmationWidgetPayload, el payload se descartaba y nunca se
    reenviaba. Ahora se rastrea widgetReady y se reenvía el payload
    al construirlo si el widget ya se había declarado listo. Se elimina
    el postMessage incondicional del final de onReady.
  - CONF-09 (P1): $w("#html2") envuelto en try/catch. Si el elemento
    no existe, el bridge se desactiva silenciosamente sin romper la
    página.
  - CONF-10 (P1): mapBackendResultToUI y renderConfirmation sanean
    data.totalAmount a un Number finito. Cualquier undefined/NaN
    produce "0,00 €" en lugar de "NaN €".

CORRECCIONES v1.2:
  - CONF-06: helpers seguros _safeCollapse / _safeExpand / _safeSetText.
    Algunos elementos (HtmlComponent, Image en ciertos temas, Slider)
    no exponen collapse/expand. Si el elemento no existe, $w lanza al
    acceder. Probamos collapse y caemos a hide; expand y caemos a show.
  - CONF-07: buildConfirmationWidgetPayload lee primero los campos
    enriquecidos por calendario-2.js (slotStart, firstName, addOns,
    etc.) y cae a bookingIds[], slotStart normalizado y addOns[] si los
    campos directos no existen.
=============================================================================
*/
import { lightbox } from "@wix/site-window";
import { location } from "@wix/site-location";
import { getConfirmedBookingForDisplay } from "backend/reservas.web.js";
import {
    _safeTrim,
    _toDateSafe,
    getMadridLocalStringNoZ,
    URLS,
} from "public/mmUtils";

const ELEMENTS = {
    TITLE: "#titleText",
    BOOKING_ID: "#bookingIdText",
    SERVICE_NAME: "#serviceNameText",
    DATE_TIME: "#dateTimeText",
    STAFF_NAME: "#staffNameText",
    TOTAL_AMOUNT: "#totalAmountText",
    STATUS: "#statusText",
    BTN_HOME: "#homeButton",
    BTN_CALENDAR: "#calendarButton",
    ERROR_MSG: "#errorMessage",
};

/* Estado del handshake HTML↔Velo (CONF-08).
 * - widgetReady: el HTML envió MM_CONFIRMATION_READY al menos una vez.
 * - confirmationWidgetPayload: payload a enviar al HTML.
 * - htmlWidget: referencia al HtmlComponent (o null si no existe). */
let widgetReady = false;
let confirmationWidgetPayload = null;
let htmlWidget = null;

/* CONF-06: helpers seguros para collapse/expand. */
function _safeCollapse(selector) {
    try {
        const el = $w(selector);
        if (!el) return;
        if (typeof el.collapse === "function") {
            el.collapse();
        } else if (typeof el.hide === "function") {
            el.hide();
        }
    } catch (_) {
        /* elemento inexistente o no colapsable: ignorar */
    }
}

function _safeExpand(selector) {
    try {
        const el = $w(selector);
        if (!el) return;
        if (typeof el.expand === "function") {
            el.expand();
        } else if (typeof el.show === "function") {
            el.show();
        }
    } catch (_) {
        /* elemento inexistente o no expandible: ignorar */
    }
}

function _safeSetText(selector, value) {
    try {
        const el = $w(selector);
        if (el && typeof el.text !== "undefined") {
            el.text = String(value ?? "");
        }
    } catch (_) {
        /* elemento inexistente: ignorar */
    }
}

/* CONF-08: envío centralizado del payload al HTML. Solo se llama cuando
 * ambos lados están listos (widgetReady && confirmationWidgetPayload). */
function _sendPayloadToWidget() {
    if (!htmlWidget || !confirmationWidgetPayload) return;
    try {
        if (typeof htmlWidget.postMessage === "function") {
            htmlWidget.postMessage({
                version: "1.0",
                type: "MM_CONFIRMATION_CONTEXT",
                payload: confirmationWidgetPayload,
            });
        }
    } catch (_) {
        /* postMessage puede lanzar si el widget aún no acepta mensajes */
    }
}

/* CONF-11: resuelve el target simbólico del HTML a URL real.
 * - MIS_RESERVAS  → URLS.MIS_RESERVAS
 * - HOME          → URLS.HOME
 * - RESERVA_ONLINE→ URLS.SERVICIOS
 * Legacy: acepta { url: "..." } limitado a rutas conocidas. */
function _resolveNavTarget(payload) {
    if (!payload || typeof payload !== "object") return "";

    if (typeof payload.target === "string") {
        const t = payload.target.toUpperCase();
        if (t === "MIS_RESERVAS") {
            return URLS.MIS_RESERVAS;
        }
        if (t === "HOME") {
            return URLS.HOME;
        }
        if (t === "RESERVA_ONLINE") {
            return URLS.SERVICIOS;
        }
        return "";
    }

    if (typeof payload.url === "string") {
        const legacyAllowed = [URLS.HOME, URLS.MIS_RESERVAS, URLS.SERVICIOS];
        return legacyAllowed.includes(payload.url) ? payload.url : "";
    }

    return "";
}

$w.onReady(async function () {
    /* CONF-09: adquirir #html2 de forma defensiva. Si no existe,
     * htmlWidget queda null y los envíos se saltan silenciosamente. */
    try {
        htmlWidget = $w("#html2");
    } catch (_) {
        htmlWidget = null;
    }

    if (htmlWidget && typeof htmlWidget.onMessage === "function") {
        try {
            htmlWidget.onMessage((event) => {
                const message = event && event.data;
                if (!message || typeof message !== "object" || !message.type) {
                    return;
                }

                /* CONF-08: el HTML se declara listo. Marcamos widgetReady y,
                 * si el payload ya está construido, lo enviamos de inmediato.
                 * Si no, el bloque de abajo lo enviará tras construirlo. */
                if (message.type === "MM_CONFIRMATION_READY") {
                    widgetReady = true;
                    _sendPayloadToWidget();
                    return;
                }

                /* CONF-11: navegación desde el HTML. */
                if (message.type === "MM_NAV" && message.payload) {
                    const targetUrl = _resolveNavTarget(message.payload);
                    if (targetUrl) {
                        try {
                            console.info(
                                "[ConfirmacionReserva] NAV →",
                                targetUrl
                            );
                            location.to(targetUrl);
                        } catch (err) {
                            console.error(
                                "[ConfirmacionReserva] location.to failed",
                                {
                                    targetUrl,
                                    error: err && err.message,
                                }
                            );
                        }
                    } else {
                        console.warn(
                            "[ConfirmacionReserva] MM_NAV sin target válido",
                            { payload: message.payload }
                        );
                    }
                }
            });
        } catch (_) {
            /* onMessage no registrable: bridge desactivado, seguimos con
             * el render local de los elementos Velo. */
        }
    }

    const context = await lightbox.getContext();

    if (!context || !context.bookingId) {
        showError("No se pudo cargar la información de la reserva.");
        return;
    }

    const { bookingId } = context;

    try {
        let displayData;

        if (context.booking && context.service) {
            displayData = mapContextToUI(context.booking, context.service);
        } else {
            const result = await getConfirmedBookingForDisplay({ bookingId });
            if (!result.ok) {
                throw new Error(result.error || "Reserva no encontrada");
            }
            displayData = mapBackendResultToUI(result.data);
        }

        confirmationWidgetPayload = buildConfirmationWidgetPayload(
            context,
            displayData
        );
        renderConfirmation(displayData);

        /* CONF-08: si el HTML ya se declaró listo (READY recibido antes de
         * terminar de construir el payload), enviamos ahora. Si no, el
         * próximo READY lo hará. Esto elimina la race de handshake. */
        if (widgetReady) {
            _sendPayloadToWidget();
        }
    } catch (error) {
        console.error("[ConfirmacionReserva] Error:", error);
        showError(
            "Ocurrió un error al cargar la confirmación. Por favor, contacte con soporte."
        );
    }
});

/**
 * CONF-07: buildConfirmationWidgetPayload lee primero los campos
 * enriquecidos por calendario-2.js (slotStart, firstName, addOns, etc.)
 * y cae a bookingIds[], slotStart normalizado y addOns[] si los campos
 * directos no existen. Resultado: payload plano y completo que el
 * HTML #html2 puede renderizar sin transformaciones adicionales.
 */
function buildConfirmationWidgetPayload(context, displayData) {
    const booking =
        context && context.booking && typeof context.booking === "object"
            ? context.booking
            : {};
    const service =
        context && context.service && typeof context.service === "object"
            ? context.service
            : {};
    const safeText = (value, max = 200) => _safeTrim(value, max);

    const bookingIdsArr = Array.isArray(booking.bookingIds)
        ? booking.bookingIds
        : [];

    const bookingIdF1 = safeText(
        booking.bookingIdF1 ||
            booking.bookingId ||
            booking.id ||
            bookingIdsArr[0] ||
            context.bookingId,
        120
    );
    const bookingIdF2 = safeText(
        booking.bookingIdF2 ||
            (bookingIdsArr.length > 1 ? bookingIdsArr[1] : ""),
        120
    );

    let fecha = safeText(booking.fecha || context.fecha || "", 80);
    let hora = safeText(booking.hora || context.hora || "", 20);
    let horaF2 = safeText(booking.horaF2 || context.horaF2 || "", 20);

    if (!fecha && booking.slotStart) {
        const startStr = getMadridLocalStringNoZ(
            _toDateSafe(booking.slotStart)
        );
        if (startStr) {
            const parts = startStr.split("T");
            const d = parts[0].split("-");
            fecha = `${d[2]}/${d[1]}/${d[0]}`;
            hora = (parts[1] || "").substring(0, 5) || hora;
        }
    }
    if (!horaF2 && booking.slotF2Start) {
        const startStr = getMadridLocalStringNoZ(
            _toDateSafe(booking.slotF2Start)
        );
        if (startStr) {
            horaF2 = (startStr.split("T")[1] || "").substring(0, 5);
        }
    }

    let extrasText = safeText(
        booking.extrasText || booking.extras || context.extras || "",
        300
    );
    if (!extrasText && Array.isArray(booking.addOns)) {
        extrasText = booking.addOns
            .map((a) => a.name || a.addonId || "")
            .filter(Boolean)
            .join(", ");
    }
    if (!extrasText) extrasText = "Ninguno";

    const duracion = safeText(
        booking.duracion ||
            booking.durationMinutes ||
            service.totalDuration ||
            context.duracion ||
            "",
        40
    );

    const amount =
        booking.total ??
        booking.totalAmount ??
        displayData.totalAmount ??
        0;

    return {
        bookingIdF1,
        bookingIdF2,
        serviceId: safeText(booking.serviceId || service.serviceId, 120),
        tituloServicio: safeText(
            service.title || displayData.serviceName || "Servicio reservado",
            160
        ),
        fecha,
        hora,
        horaF2,
        duracion,
        extras: extrasText,
        total: Number.isFinite(Number(amount)) ? Number(amount) : 0,
        appointmentNote: safeText(
            booking.appointmentNote ||
                context.appointmentNote ||
                context.nota,
            200
        ),
        isCombined:
            booking.isCombined === true ||
            booking.isDual === true ||
            Boolean(bookingIdF2),
        serviceName: safeText(
            displayData.serviceName || service.title,
            160
        ),
        dateTime: safeText(displayData.dateTime, 100),
        status: safeText(displayData.status || "CONFIRMED", 40),
    };
}

function mapContextToUI(booking, service) {
    const slotStart =
        booking.slotStart || booking.startDate || booking.slotF1?.localStartDate;
    return {
        bookingId: booking.bookingId || booking.id,
        serviceName: service?.title || "Servicio Reservado",
        dateTime: formatDateTime(slotStart),
        totalAmount: booking.total ?? booking.totalAmount ?? service?.price ?? 0,
        status: "CONFIRMED",
    };
}

function mapBackendResultToUI(data) {
    /* CONF-10: saneo defensivo. El backend puede no devolver totalAmount. */
    const safeAmount = Number.isFinite(Number(data && data.totalAmount))
        ? Number(data.totalAmount)
        : 0;
    return {
        bookingId: (data && data.bookingId) || "",
        serviceName: "Servicio Confirmado",
        dateTime: formatDateTime(data && data.slotStart),
        totalAmount: safeAmount,
        status: (data && data.bookingStatus) || "CONFIRMED",
    };
}

function renderConfirmation(data) {
    _safeSetText(ELEMENTS.TITLE, "¡Reserva Confirmada!");
    _safeSetText(
        ELEMENTS.BOOKING_ID,
        `ID: ${_safeTrim(data && data.bookingId)}`
    );
    _safeSetText(ELEMENTS.SERVICE_NAME, data && data.serviceName);
    _safeSetText(ELEMENTS.DATE_TIME, data && data.dateTime);
    /* La asignación de profesional es información interna: nunca mostrarla. */
    _safeCollapse(ELEMENTS.STAFF_NAME);

    /* CONF-10: formateo de moneda tolerante a undefined/NaN. */
    const rawAmount = Number(data && data.totalAmount);
    const safeAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
    const formatter = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
    });
    _safeSetText(ELEMENTS.TOTAL_AMOUNT, formatter.format(safeAmount));
    _safeSetText(ELEMENTS.STATUS, "Estado: Confirmado");

    _safeCollapse(ELEMENTS.ERROR_MSG);
}

function formatDateTime(dateInput) {
    if (!dateInput) return "Fecha por confirmar";
    const date = _toDateSafe(dateInput);
    if (!date) return "Fecha inválida";
    const madridString = getMadridLocalStringNoZ(date);
    const [datePart, timePart] = madridString.split("T");
    const [year, month, day] = datePart.split("-");
    return `${day}/${month}/${year} a las ${(timePart || "").substring(0, 5)}`;
}

function showError(message) {
    _safeSetText(ELEMENTS.TITLE, "Error");
    _safeSetText(ELEMENTS.ERROR_MSG, message);
    _safeExpand(ELEMENTS.ERROR_MSG);

    _safeCollapse(ELEMENTS.BOOKING_ID);
    _safeCollapse(ELEMENTS.SERVICE_NAME);
    _safeCollapse(ELEMENTS.DATE_TIME);
    _safeCollapse(ELEMENTS.STAFF_NAME);
    _safeCollapse(ELEMENTS.TOTAL_AMOUNT);
    _safeCollapse(ELEMENTS.STATUS);
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

export function homeButton_click(event) {
    location.to(URLS.HOME);
}

export function calendarButton_click(event) {
    location.to(URLS.SERVICIOS);
}
