import { Permissions, webMethod } from "wix-web-module";
import { auth } from "@wix/essentials";
import { services } from "@wix/bookings";
import { catalogVersioning, productsV3 } from "@wix/stores";
import { TPV_SANDBOX_IDENTITY_TYPES } from "backend/internalConfig";
import { listTpvSandboxIdentities, getTpvSandboxIdentity } from "backend/tpv/tpvSandboxIdentities";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

const getCatalogVersionElevated = auth.elevate(catalogVersioning.getCatalogVersion);
const queryServicesElevated = auth.elevate(services.queryServices);
const queryProductsElevated = auth.elevate(productsV3.queryProducts);
const getProductElevated = auth.elevate(productsV3.getProduct);

let catalogVersionPromise = null;

function toMinorUnits(value) {
    const raw = value && typeof value === "object"
        ? (value.amount ?? value.value ?? null)
        : value;
    if (raw === null || raw === undefined || raw === "") return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const minor = Math.round((amount + Number.EPSILON) * 100);
    return Math.abs(amount * 100 - minor) <= 1e-7 ? minor : null;
}

function normalizePage(input = {}) {
    const limit = Number(input.limit ?? 100);
    const offset = Number(input.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isInteger(offset) || offset < 0) {
        throw new Error("TPV_INVALID_CATALOG_PAGING");
    }
    return { limit, offset };
}

async function getStoresCatalogVersion() {
    if (!catalogVersionPromise) {
        catalogVersionPromise = getCatalogVersionElevated()
            .then((result) => String(result?.catalogVersion || "UNKNOWN"))
            .catch((error) => {
                catalogVersionPromise = null;
                throw error;
            });
    }
    return catalogVersionPromise;
}

function mapProduct(product) {
    const minimum = product?.variantSummary?.minPriceVariant?.price?.actualPrice || null;
    const amount = minimum?.amount ?? null;
    return {
        itemId: product._id,
        tipoLinea: "PRODUCTO",
        concepto: String(product.name || "Producto"),
        descripcion: String(product.plainDescription || "").slice(0, 240),
        moneda: product.currency || null,
        precioMinimo: amount,
        precioMinor: toMinorUnits(amount),
        precioFormateado: minimum?.formattedAmount || null,
        numeroVariantes: Number(product.variantSummary?.variantCount || 0),
        requiereSeleccionVariante: Number(product.variantSummary?.variantCount || 0) > 1,
        visibleEnPos: product.visibleInPos !== false,
        tipoProducto: product.productType || null,
        inventario: product.inventory?.availabilityStatus || null,
    };
}

export const buscarClientesTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-customer-search");
        await requireCajero(traceId);
        try {
            const search = String(input.search || "").trim().slice(0, 100).toLowerCase();
            if (search.length < 2) throw new Error("TPV_CUSTOMER_SEARCH_TOO_SHORT");
            const customers = await listTpvSandboxIdentities(TPV_SANDBOX_IDENTITY_TYPES.CUSTOMER);
            const matches = customers.filter((item) =>
                item.displayName.toLowerCase().includes(search) ||
                String(item.email || "").toLowerCase().includes(search)
            );
            return {
                status: "SUCCESS",
                data: {
                    items: matches.map((item) => ({
                        identityId: item.identityId,
                        displayName: item.displayName,
                        email: item.email || "",
                        phone: "",
                        isSynthetic: true,
                    })),
                    pagingMetadata: null,
                    syntheticOnly: true,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_CUSTOMER_SEARCH_FAILED") },
                syntheticOnly: true,
                traceId,
            };
        }
    }
);

export const obtenerReservasClienteTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-customer-bookings");
        await requireCajero(traceId);
        const contactId = String(input.contactId || "").trim();
        const customer = await getTpvSandboxIdentity(contactId, TPV_SANDBOX_IDENTITY_TYPES.CUSTOMER);
        if (!customer) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_SANDBOX_CUSTOMER_NOT_ALLOWED" },
                syntheticOnly: true,
                traceId,
            };
        }
        return {
            status: "SUCCESS",
            data: { items: [], pagingMetadata: null, syntheticOnly: true },
            error: null,
            traceId,
        };
    }
);

export const obtenerServicios = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-services-read"));
        try {
            const paging = normalizePage(input);
            const result = await queryServicesElevated({ paging }, {});
            const items = (result?.services || []).map((service) => ({
                itemId: service._id,
                tipoLinea: "SERVICIO",
                concepto: service.name,
                descripcion: service.tagLine || service.description || "",
                tipoServicio: service.type || null,
                categoria: service.category?.name || null,
                oculto: service.hidden === true,
                tipoTarifa: service.payment?.rateType || null,
                precioFijo: service.payment?.fixed?.price?.value ?? null,
                precioMinor: toMinorUnits(service.payment?.fixed?.price?.value),
                precioFormateado: service.payment?.fixed?.price?.formattedValue ?? null,
                moneda: service.payment?.fixed?.price?.currency || null,
            }));
            return {
                status: "SUCCESS",
                data: { items, pagingMetadata: result?.pagingMetadata || null },
                error: null,
            };
        } catch (_) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_SERVICES_READ_FAILED" },
            };
        }
    }
);

export const obtenerStaff = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-staff-read");
        await requireCajero(traceId);
        return {
            status: "SUCCESS",
            data: {
                items: (await listTpvSandboxIdentities(TPV_SANDBOX_IDENTITY_TYPES.STAFF)).map((staff) => ({
                    profesionalId: staff.identityId,
                    nombre: staff.displayName,
                    resourceId: staff.identityId,
                    esProveedorServicio: true,
                    isSynthetic: true,
                })),
                pagingMetadata: null,
                syntheticOnly: true,
            },
            error: null,
            traceId,
        };
    }
);

export const obtenerProductos = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-products-read"));
        try {
            const version = await getStoresCatalogVersion();
            if (version === "STORES_NOT_INSTALLED") {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TPV_STORES_NOT_INSTALLED" },
                };
            }
            if (version !== "V3_CATALOG") {
                return {
                    status: "ERROR",
                    data: { catalogVersion: version },
                    error: {
                        code: "TPV_STORES_CATALOG_VERSION_UNSUPPORTED",
                        message: "Esta integración POS requiere Catalog V3; no se ejecuta una consulta V3 contra Catalog V1.",
                    },
                };
            }
            const limit = Number(input.limit ?? 100);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_PRODUCT_PAGING");
            }
            const query = {
                cursorPaging: {
                    limit,
                    ...(input.cursor ? { cursor: String(input.cursor).slice(0, 16000) } : {}),
                },
            };
            const result = await queryProductsElevated(query, {
                fields: ["CURRENCY", "MIN_PRICE_VARIANT", "PLAIN_DESCRIPTION"],
            });
            const items = (result?.products || [])
                .filter((product) => product?.visible === true && product?.visibleInPos !== false)
                .map(mapProduct);
            return {
                status: "SUCCESS",
                data: {
                    catalogVersion: version,
                    items,
                    pagingMetadata: result?.pagingMetadata || null,
                },
                error: null,
            };
        } catch (_) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_STORES_PRODUCTS_READ_FAILED" },
            };
        }
    }
);

export const obtenerVariantesProducto = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-product-variants-read"));
        try {
            const productId = String(input.productId || "").trim();
            if (!/^[a-zA-Z0-9-]{1,36}$/.test(productId)) {
                throw new Error("TPV_INVALID_PRODUCT_ID");
            }
            const version = await getStoresCatalogVersion();
            if (version !== "V3_CATALOG") {
                return {
                    status: "ERROR",
                    data: { catalogVersion: version },
                    error: { code: "TPV_STORES_CATALOG_VERSION_UNSUPPORTED" },
                };
            }
            const product = await getProductElevated(productId, {
                fields: ["VARIANT_OPTION_CHOICE_NAMES", "CURRENCY"],
            });
            if (!product || product.visible !== true || product.visibleInPos === false) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TPV_PRODUCT_NOT_AVAILABLE_IN_POS" },
                };
            }
            const variantes = (product.variantsInfo?.variants || [])
                .filter((variant) => variant.visible !== false)
                .map((variant) => ({
                    varianteId: variant._id,
                    sku: variant.sku || null,
                    concepto: (variant.choices || [])
                        .map((choice) => choice.optionChoiceNames)
                        .filter(Boolean)
                        .map((choice) => [choice.optionName, choice.choiceName].filter(Boolean).join(": "))
                        .join(" · ") || "Variante predeterminada",
                    precio: variant.price?.actualPrice?.amount ?? null,
                    precioMinor: toMinorUnits(variant.price?.actualPrice?.amount),
                    precioFormateado: variant.price?.actualPrice?.formattedAmount ?? null,
                    moneda: product.currency || null,
                    disponible: variant.inventoryStatus?.inStock !== false ||
                        variant.inventoryStatus?.preorderEnabled === true,
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
            };
        } catch (_) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_PRODUCT_VARIANTS_READ_FAILED" },
            };
        }
    }
);
