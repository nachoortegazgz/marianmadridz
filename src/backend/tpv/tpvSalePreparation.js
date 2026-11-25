import { auth } from "@wix/essentials";
import { services } from "@wix/bookings";
import { productsV3 } from "@wix/stores";
import { taxCalculation, taxSettings } from "@wix/ecom";
import { TPV_CATALOG_APP_IDS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { listAuthorizedProfessionals } from "backend/tpv/tpvNativeDirectory";
import {
    buildTpvTaxCalculationLines,
    mapTpvTaxCalculation,
    normalizeTpvSaleLineRequests,
} from "backend/tpv/tpvSalePreparationCore";

const queryServicesElevated = auth.elevate(services.queryServices);
const getProductElevated = auth.elevate(productsV3.getProduct);
const calculateTaxElevated = auth.elevate(taxCalculation.calculateTax);
const getTaxSettingsElevated = auth.elevate(taxSettings.getTaxSettings);

function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
}

function getEntityId(value) {
    return String(value?._id || value?.id || "").trim();
}

function resolveProductVariant(product, request) {
    const variants = (product?.variantsInfo?.variants || [])
        .filter((variant) => variant?.visible !== false);
    if (variants.length === 0) fail("TPV_PRODUCT_VARIANTS_UNAVAILABLE");

    let variant = null;
    if (request.varianteId) {
        variant = variants.find((candidate) => getEntityId(candidate) === request.varianteId) || null;
        if (!variant) fail("TPV_PRODUCT_VARIANT_NOT_FOUND");
    } else if (variants.length === 1) {
        variant = variants[0];
    } else {
        fail("TPV_PRODUCT_VARIANT_REQUIRED");
    }

    const price = variant?.price?.actualPrice?.amount;
    if (price === null || price === undefined || price === "") {
        fail("TPV_CATALOG_PRICE_UNAVAILABLE");
    }

    const variantLabel = (variant?.choices || [])
        .map((choice) => choice?.optionChoiceNames)
        .filter(Boolean)
        .map((choice) => [choice.optionName, choice.choiceName].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(" · ");

    return {
        itemId: getEntityId(product),
        tipoLinea: "PRODUCTO",
        ...(getEntityId(variant) ? { varianteId: getEntityId(variant) } : {}),
        concepto: [String(product.name || "").trim(), variantLabel].filter(Boolean).join(" · "),
        cantidad: request.cantidad,
        precioUnitario: String(price),
        currency: String(product.currency || "").toUpperCase(),
        appId: TPV_CATALOG_APP_IDS.WIX_STORES,
        ...(product.taxGroupId ? { taxGroupId: product.taxGroupId } : {}),
        profesionalId: request.profesionalId,
        stockAfectado: request.stockAfectado,
    };
}

async function resolveProducts(requests) {
    const ids = [...new Set(requests.map((line) => line.itemId))];
    const products = await Promise.all(ids.map(async (productId) => {
        const product = await getProductElevated(productId, {
            fields: ["CURRENCY", "VARIANT_OPTION_CHOICE_NAMES"],
        });
        if (!product || getEntityId(product) !== productId ||
            product.visible !== true || product.visibleInPos !== true) {
            fail("TPV_PRODUCT_NOT_AVAILABLE_IN_POS");
        }
        return [productId, product];
    }));
    const byId = new Map(products);
    return requests.map((request) => resolveProductVariant(byId.get(request.itemId), request));
}

async function resolveServices(requests) {
    const result = await queryServicesElevated({
        filter: { hidden: { $eq: false } },
        paging: { limit: 100, offset: 0 },
    }, {});

    const servicesList = Array.isArray(result?.services) ? result.services : [];
    const total = Number(result?.pagingMetadata?.total ?? servicesList.length);
    if (result?.pagingMetadata?.tooManyToCount === true ||
        result?.pagingMetadata?.hasNext === true || total > servicesList.length) {
        fail("TPV_SERVICE_CATALOG_PAGE_INCOMPLETE");
    }

    const byId = new Map(servicesList.map((service) => [getEntityId(service), service]));
    return requests.map((request) => {
        const service = byId.get(request.itemId);
        if (!service || service.hidden === true) fail("TPV_SERVICE_NOT_AVAILABLE");

        if (String(service.type || "").toUpperCase() !== "APPOINTMENT") {
            fail("TPV_SERVICE_TYPE_NOT_SUPPORTED");
        }
        if (String(service.payment?.rateType || "").toUpperCase() !== "FIXED") {
            fail("TPV_SERVICE_PRICE_NOT_FIXED");
        }

        const price = service.payment?.fixed?.price?.value;
        const currency = String(service.payment?.fixed?.price?.currency || "").toUpperCase();
        if (price === null || price === undefined || price === "") {
            fail("TPV_CATALOG_PRICE_UNAVAILABLE");
        }
        if (currency !== "EUR") fail("TPV_CATALOG_CURRENCY_MISMATCH");

        return {
            itemId: getEntityId(service),
            tipoLinea: "SERVICIO",
            concepto: String(service.name || "").trim(),
            cantidad: request.cantidad,
            precioUnitario: String(price),
            currency,
            appId: TPV_CATALOG_APP_IDS.WIX_BOOKINGS,
            ...(service.taxGroupId ? { taxGroupId: service.taxGroupId } : {}),
            profesionalId: request.profesionalId,
            stockAfectado: false,
        };
    });
}

/**
 * Prepares a read-only TPV sale using Wix-owned catalog prices and Wix tax
 * calculation. It never creates orders, payments, CMS records or ledger events.
 */
export async function prepareTpvSaleCatalog(inputLines) {
    const rawRequests = normalizeTpvSaleLineRequests(inputLines);
    const requests = rawRequests.some((line) => line.profesionalId)
        ? await (async () => {
            const professionals = await listAuthorizedProfessionals();
            const byResourceId = new Map(professionals.map((person) => [person.resourceId, person]));
            return rawRequests.map((line) => {
                if (!line.profesionalId) return line;
                const professional = byResourceId.get(line.profesionalId);
                if (!professional) fail("TPV_STAFF_NOT_ALLOWED");
                return { ...line, profesionalId: professional.resourceId };
            });
        })()
        : rawRequests;

    const productRequests = requests.filter((line) => line.tipoLinea === "PRODUCTO");
    const serviceRequests = requests.filter((line) => line.tipoLinea === "SERVICIO");

    const [products, serviceLines] = await Promise.all([
        productRequests.length > 0 ? resolveProducts(productRequests) : Promise.resolve([]),
        serviceRequests.length > 0 ? resolveServices(serviceRequests) : Promise.resolve([]),
    ]);

    let productIndex = 0;
    let serviceIndex = 0;
    const catalogLines = requests.map((request) => {
        const resolved = request.tipoLinea === "PRODUCTO"
            ? products[productIndex++]
            : serviceLines[serviceIndex++];
        if (!resolved) fail("TPV_CATALOG_ITEM_NOT_FOUND");
        return resolved;
    });

    const taxSettingsResult = await getTaxSettingsElevated();
    const taxIncludedInPrice = taxSettingsResult?.taxSettings?.taxIncludedInItemPrices;
    if (typeof taxIncludedInPrice !== "boolean") fail("TPV_TAX_SETTINGS_UNAVAILABLE");

    const taxLineItems = buildTpvTaxCalculationLines(catalogLines, taxIncludedInPrice);
    const taxResult = await calculateTaxElevated({
        currency: TPV_RUNTIME_POLICY.CURRENCY_CODE,
        addresses: [{ country: TPV_RUNTIME_POLICY.TAX_COUNTRY }],
        lineItems: taxLineItems,
    });

    const prepared = mapTpvTaxCalculation({
        catalogLines,
        taxResult,
        taxIncludedInPrice,
    });
    return Object.freeze({
        ...prepared,
        taxCurrency: String(taxResult.currency || ""),
        taxIncludedInPrice: prepared.taxIncludedInPrice,
        taxIncludedInPriceAmount: prepared.taxIncludedInPriceAmount,
        taxCalculatorIds: prepared.taxCalculatorIds,
        taxSummary: {
            totalTax: String(taxResult.taxSummary?.totalTax || "0"),
            totalTaxableAmount: String(taxResult.taxSummary?.totalTaxableAmount || "0"),
            totalTaxIncludedInPrice: String(taxResult.taxSummary?.totalTaxIncludedInPrice || "0"),
        },
        paymentVerified: false,
        persisted: false,
    });
}
