import { Permissions, webMethod } from "wix-web-module";
import { services, staffMembers } from "@wix/bookings";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";


export const obtenerServicios = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-services-read"));
        try {
            const paging = normalizePage(input);
            const result = await services.queryServices({ paging }, {});
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

export const obtenerProfesionales = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-staff-read"));
        try {
            const limit = Number(input.limit ?? 100);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_STAFF_PAGING");
            }
            const result = await staffMembers.queryStaffMembersV2({
                query: {
                    filter: { serviceProvider: true },
                    cursorPaging: { limit },
                },
            });
            const items = (result?.staffMembers || []).map((staff) => ({
                profesionalId: staff._id,
                nombre: staff.name,
                resourceId: staff.resourceId || null,
                esProveedorServicio: staff.serviceProvider === true,
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
                error: { code: "TPV_STAFF_READ_FAILED" },
            };
        }
    }
);

export const obtenerProductos = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-products-read"));
        return {
            status: "ERROR",
            data: null,
            error: {
                code: "TPV_STORES_SDK_INSTALL_BLOCKED",
                message: "Wix Stores Catalog V3 está instalado en el sitio, pero el SDK no se ha añadido al lockfile del repositorio. No se ejecuta una consulta sin dependencia reproducible.",
            },
        };
    }
);

export const obtenerVariantesProducto = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-product-variants-read"));
        return {
            status: "ERROR",
            data: null,
            error: { code: "TPV_STORES_SDK_INSTALL_BLOCKED" },
        };
    }
);
