import { Permissions, webMethod } from "wix-web-module";
import { auth } from "@wix/essentials";
import { services } from "@wix/bookings";
import { catalogVersioning, productsV3 } from "@wix/stores";
import {
    searchTpvContacts,
    resolveTpvContact,
    listAuthorizedProfessionals,
} from "backend/tpv/tpvNativeDirectory";
import { requireTpvOperator } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { toMinorUnits as toMinorUnitsStrict } from "backend/tpv/tpvUtils";
import { normalizeTpvError } from "backend/tpv/tpvError";

const getCatalogVersionElevated = auth.elevate(
    catalogVersioning.getCatalogVersion
);
const queryServicesElevated = auth.elevate(services.queryServices);
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const queryProductsElevated = auth.elevate(productsV3.queryProducts);
const getProductElevated = auth.elevate(productsV3.getProduct);

let catalogVersionPromise = null;

function toMinorUnits(value) {
    const raw = value && typeof value === "object"
        ? value.amount ?? value.value ?? null
        : value;

    if (raw === null || raw === undefined || raw === "") {
        return null;
    }

    try {
        return toMinorUnitsStrict(raw, "CATALOG_PRICE");
    } catch (_) {
        return null;
    }
}

function normalizePage(input = {}) {
    const limit = Number(input.limit ?? 100);
    const offset = Number(input.offset ?? 0);

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0
    ) {
        throw new Error("TPV_INVALID_CATALOG_PAGING");
    }

    return {
        limit,
        offset,
    };
}

async function getStoresCatalogVersion() {
    if (!catalogVersionPromise) {
        catalogVersionPromise = getCatalogVersionElevated()
            .then((result) =>
                String(result?.catalogVersion || "UNKNOWN")
            )
            .catch((error) => {
                catalogVersionPromise = null;
                throw error;
            });
    }

    return catalogVersionPromise;
}

function mapProduct(product) {
    const minimum =
        product?.variantSummary?.minPriceVariant?.price?.actualPrice ||
        null;

    const amount = minimum?.amount ?? null;

    return {
        itemId: product._id,
        tipoLinea: "PRODUCTO",
        concepto: String(product.name || "Producto"),
        descripcion: String(
            product.plainDescription || ""
        ).slice(0, 240),
        moneda: product.currency || null,
        precioMinimo: amount,
        precioMinor: toMinorUnits(amount),
        precioFormateado: minimum?.formattedAmount || null,
        numeroVariantes: Number(
            product.variantSummary?.variantCount || 0
        ),
        requiereSeleccionVariante:
            Number(product.variantSummary?.variantCount || 0) > 1,
        visibleEnPos: product.visibleInPos !== false,
        tipoProducto: product.productType || null,
        inventario:
            product.inventory?.availabilityStatus || null,
    };
}

export const buscarClientesTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-customer-search");

        await requireTpvOperator(traceId);

        try {
            const result = await searchTpvContacts(input.search);

            return {
                status: "SUCCESS",
                data: result,
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_CUSTOMER_SEARCH_FAILED"
                ),
                traceId,
            };
        }
    }
);

export const obtenerReservasClienteTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-customer-bookings");

        await requireTpvOperator(traceId);

        try {
            const contactId = String(
                input.identityId || ""
            ).trim();

            const customer = await resolveTpvContact(contactId);

            if (!customer) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TPV_CUSTOMER_NOT_ALLOWED",
                    },
                    traceId,
                };
            }

            const limit = Number(input.limit ?? 50);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_BOOKINGS_PAGING");
            }
            const cursor = String(input.cursor || "").trim();
            if (cursor.length > 16000) throw new Error("TPV_INVALID_BOOKINGS_CURSOR");

            const result = await queryExtendedBookingsElevated(
                {
                    filter: {
                        "booking.contactDetails.contactId": contactId,
                        "booking.status": {
                            $in: ["CONFIRMED", "PENDING", "CREATED"],
                        },
                    },
                    sort: [{
                        fieldName: "booking.startDate",
                        order: "DESC",
                    }],
                    cursorPaging: {
                        limit,
                        ...(cursor ? { cursor } : {}),
                    },
                },
                {
                    withBookingAllowedActions: false,
                    withBookingAttendanceInfo: false,
                    withBookingConferencingDetails: false,
                    withBookingPolicySettings: false,
                    withBookingFeeDetails: false,
                }
            );

            const items = (result?.extendedBookings || []).map((entry) => {
                const booking = entry?.booking || {};
                const bookedEntity = booking.bookedEntity || {};
                const slot = bookedEntity.slot || bookedEntity.schedule || {};
                const resource = slot.resource || {};
                const location = slot.location || {};
                return {
                    bookingId: booking._id || booking.id || null,
                    serviceId: slot.serviceId || null,
                    scheduleId: slot.scheduleId || null,
                    serviceName: bookedEntity.title || null,
                    startDate: booking.startDate || slot.startDate || null,
                    endDate: booking.endDate || slot.endDate || null,
                    status: booking.status || "UNKNOWN",
                    paymentStatus: booking.paymentStatus || "UNKNOWN",
                    selectedPaymentOption: booking.selectedPaymentOption || null,
                    totalParticipants: Number(booking.totalParticipants || 1),
                    staffName: resource.name || null,
                    locationName: location.name || location.formattedAddress || null,
                    revision: booking.revision || null,
                    doubleBooked: booking.doubleBooked === true,
                    allowedActions: entry.allowedActions || null,
                };
            });

            return {
                status: "SUCCESS",
                data: {
                    items,
                    pagingMetadata: result?.pagingMetadata || null,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_CUSTOMER_BOOKINGS_FAILED"
                ),
                traceId,
            };
        }
    }
);

export const obtenerServicios = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-services-read");

        await requireTpvOperator(traceId);

        try {
            const paging = normalizePage(input);

            const result = await queryServicesElevated(
                {
                    filter: {
                        hidden: {
                            $eq: false,
                        },
                    },
                    paging,
                },
                {}
            );

            const items = (result?.services || []).map((service) => ({
                itemId: service._id,
                tipoLinea: "SERVICIO",
                concepto: service.name,
                descripcion:
                    service.tagLine ||
                    service.description ||
                    "",
                tipoServicio: service.type || null,
                categoria: service.category?.name || null,
                oculto: service.hidden === true,
                tipoTarifa:
                    service.payment?.rateType || null,
                precioFijo:
                    service.payment?.fixed?.price?.value ??
                    null,
                precioMinor: toMinorUnits(
                    service.payment?.fixed?.price?.value
                ),
                precioFormateado:
                    service.payment?.fixed?.price
                        ?.formattedValue || null,
                moneda:
                    service.payment?.fixed?.price
                        ?.currency || null,
            }));

            return {
                status: "SUCCESS",
                data: {
                    items,
                    pagingMetadata:
                        result?.pagingMetadata || null,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_SERVICES_READ_FAILED"
                ),
                traceId,
            };
        }
    }
);

export const obtenerStaff = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-staff-read");

        await requireTpvOperator(traceId);

        try {
            return {
                status: "SUCCESS",
                data: {
                    items: await listAuthorizedProfessionals(),
                    pagingMetadata: null,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_STAFF_READ_FAILED"
                ),
                traceId,
            };
        }
    }
);

export const obtenerProductos = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-products-read");

        await requireTpvOperator(traceId);

        try {
            const version = await getStoresCatalogVersion();

            if (version === "STORES_NOT_INSTALLED") {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TPV_STORES_NOT_INSTALLED",
                    },
                    traceId,
                };
            }

            if (version !== "V3_CATALOG") {
                return {
                    status: "ERROR",
                    data: {
                        catalogVersion: version,
                    },
                    error: {
                        code:
                            "TPV_STORES_CATALOG_VERSION_UNSUPPORTED",
                        message:
                            "Esta integración POS requiere Catalog V3; " +
                            "no se ejecuta una consulta V3 contra Catalog V1.",
                    },
                    traceId,
                };
            }

            const limit = Number(input.limit ?? 100);

            if (
                !Number.isInteger(limit) ||
                limit < 1 ||
                limit > 100
            ) {
                throw new Error("TPV_INVALID_PRODUCT_PAGING");
            }

            const query = {
                cursorPaging: {
                    limit,
                    ...(input.cursor
                        ? {
                            cursor: String(
                                input.cursor
                            ).slice(0, 16000),
                        }
                        : {}),
                },
            };

            const result = await queryProductsElevated(
                query,
                {
                    fields: [
                        "CURRENCY",
                        "MIN_PRICE_VARIANT",
                        "PLAIN_DESCRIPTION",
                    ],
                }
            );

            const items = (result?.products || [])
                .filter(
                    (product) =>
                        product?.visible === true &&
                        product?.visibleInPos !== false
                )
                .map(mapProduct);

            return {
                status: "SUCCESS",
                data: {
                    catalogVersion: version,
                    items,
                    pagingMetadata:
                        result?.pagingMetadata || null,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_STORES_PRODUCTS_READ_FAILED"
                ),
                traceId,
            };
        }
    }
);

export const obtenerVariantesProducto = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId(
            "tpv-product-variants-read"
        );

        await requireTpvOperator(traceId);

        try {
            const productId = String(
                input.productId || ""
            ).trim();

            if (!/^[a-zA-Z0-9-]{1,36}$/.test(productId)) {
                throw new Error("TPV_INVALID_PRODUCT_ID");
            }

            const version = await getStoresCatalogVersion();

            if (version !== "V3_CATALOG") {
                return {
                    status: "ERROR",
                    data: {
                        catalogVersion: version,
                    },
                    error: {
                        code:
                            "TPV_STORES_CATALOG_VERSION_UNSUPPORTED",
                    },
                    traceId,
                };
            }

            const product = await getProductElevated(
                productId,
                {
                    fields: [
                        "VARIANT_OPTION_CHOICE_NAMES",
                        "CURRENCY",
                    ],
                }
            );

            if (
                !product ||
                product.visible !== true ||
                product.visibleInPos === false
            ) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code:
                            "TPV_PRODUCT_NOT_AVAILABLE_IN_POS",
                    },
                    traceId,
                };
            }

            const variantes = (
                product.variantsInfo?.variants || []
            )
                .filter(
                    (variant) => variant.visible !== false
                )
                .map((variant) => ({
                    varianteId: variant._id,
                    sku: variant.sku || null,
                    concepto:
                        (variant.choices || [])
                            .map(
                                (choice) =>
                                    choice.optionChoiceNames
                            )
                            .filter(Boolean)
                            .map((choice) =>
                                [
                                    choice.optionName,
                                    choice.choiceName,
                                ]
                                    .filter(Boolean)
                                    .join(": ")
                            )
                            .join(" · ") ||
                        "Variante predeterminada",
                    precio:
                        variant.price?.actualPrice?.amount ??
                        null,
                    precioMinor: toMinorUnits(
                        variant.price?.actualPrice?.amount
                    ),
                    precioFormateado:
                        variant.price?.actualPrice
                            ?.formattedAmount || null,
                    moneda: product.currency || null,
                    disponible:
                        variant.inventoryStatus?.inStock === true ||
                        variant.inventoryStatus
                            ?.preorderEnabled === true,
                }));

            return {
                status: "SUCCESS",
                data: {
                    itemId: product._id,
                    concepto: product.name,
                    variantes,
                    moneda: product.currency || null,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(
                    error,
                    "TPV_PRODUCT_VARIANTS_READ_FAILED"
                ),
                traceId,
            };
        }
    }
);
