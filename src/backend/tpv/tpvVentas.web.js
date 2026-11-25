import { Permissions, webMethod } from "wix-web-module";
import { auth } from "@wix/essentials";
import { productsV3 } from "@wix/stores";
import { draftOrders, taxCalculation, taxGroups, taxRegions } from "@wix/ecom";
import { requireCajero, getMyStaffContext } from "backend/security";
import {
    getItem,
    insertItem,
    updateItem,
} from "backend/dataAccess";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError } from "backend/tpv/tpvEnvelope";
import { registerTpvSaleDraft } from "backend/tpv/tpvSaleDraftCore";

const getProductElevated = auth.elevate(productsV3.getProduct);
const createDraftOrderElevated = auth.elevate(draftOrders.createDraftOrder);
const getDraftOrderElevated = auth.elevate(draftOrders.getDraftOrder);
const queryDraftOrdersElevated = auth.elevate(draftOrders.queryDraftOrders);
const deleteDraftOrderElevated = auth.elevate(draftOrders.deleteDraftOrder);
const queryTaxRegionsElevated = auth.elevate(taxRegions.queryTaxRegions);
const queryTaxGroupsElevated = auth.elevate(taxGroups.queryTaxGroups);
const listDefaultTaxGroupsElevated = auth.elevate(taxGroups.listDefaultTaxGroupsByAppIds);
const calculateTaxElevated = auth.elevate(taxCalculation.calculateTax);

const SALE_DRAFT_DEPENDENCIES = Object.freeze({
    getItem,
    insertItem,
    updateItem,
    getProduct: getProductElevated,
    createDraftOrder: createDraftOrderElevated,
    getDraftOrder: getDraftOrderElevated,
    queryDraftOrders: queryDraftOrdersElevated,
    deleteDraftOrder: deleteDraftOrderElevated,
    queryTaxRegions: queryTaxRegionsElevated,
    queryTaxGroups: queryTaxGroupsElevated,
    listDefaultTaxGroupsByAppIds: listDefaultTaxGroupsElevated,
    calculateTax: calculateTaxElevated,
});

export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta) => {
        await requireCajero(makeTraceId("tpv-sale-validate"));
        try {
            return {
                status: "SUCCESS",
                data: {
                    ...validateSaleDraft(venta),
                    validationScope: "STRUCTURAL_ONLY",
                    catalogVerified: false,
                    fiscalVerified: false,
                    paymentVerified: false,
                },
                error: null,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: "TPV_SALE_VALIDATION_FAILED",
                    reasonCode: String(error?.message || "TPV_SALE_VALIDATION_FAILED"),
                    message: "El borrador no supera las validaciones.",
                },
            };
        }
    }
);

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sale-draft");
        await requireCajero(traceId);

        let staffContext;
        try {
            staffContext = await getMyStaffContext(traceId);
        } catch {
            return tpvError(
                "TPV_OPERATOR_CONTEXT_UNAVAILABLE",
                "No se pudo resolver la identidad del profesional que registra la venta.",
                ["Verificar la asignación del empleado en MapaStaff y volver a intentar."],
                { traceId, retryable: false }
            );
        }

        return registerTpvSaleDraft(
            input,
            {
                traceId,
                operatorResourceId: staffContext?.resourceId || staffContext?.operatorResourceId || "",
            },
            SALE_DRAFT_DEPENDENCIES
        );
    }
);
