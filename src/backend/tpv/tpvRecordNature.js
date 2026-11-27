import { BUSINESS_COLLECTIONS } from "backend/internalConfig";
import { CONSISTENCY, queryItems, wql } from "backend/dataAccess";

const NATURES = Object.freeze({ SYNTHETIC: "SYNTHETIC", REAL: "REAL" });

function validUtcInstant(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyTpvRecordNature(recordTimestamp, productionActivationAt = null) {
    const timestamp = validUtcInstant(recordTimestamp);
    if (!timestamp) throw new Error("TPV_RECORD_TIMESTAMP_INVALID");
    if (productionActivationAt === null || productionActivationAt === undefined || productionActivationAt === "") {
        return NATURES.SYNTHETIC;
    }
    const activation = validUtcInstant(productionActivationAt);
    if (!activation) throw new Error("TPV_PRODUCTION_ACTIVATION_AT_INVALID");
    return timestamp.getTime() < activation.getTime() ? NATURES.SYNTHETIC : NATURES.REAL;
}

/**
 * Server-only metadata for every newly persisted TPV event.
 * The single activation cutoff is read from the existing MapaStaff system
 * configuration record; no client-supplied timestamp or nature is accepted.
 * No configuration row means development-only SYNTHETIC classification.
 */
export async function createTpvRecordMetadata() {
    const recordTimestamp = new Date().toISOString();
    const config = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MAPA_STAFF,
        filter: wql.eq("recordType", "CONFIG_SISTEMA"),
        limit: 2,
        consistency: CONSISTENCY.STRONG,
    });
    if (config.totalCount > 1) throw new Error("TPV_PRODUCTION_CONFIG_AMBIGUOUS");
    const activationValue = config.items[0]?.productionActivationAt ?? null;
    const recordNature = classifyTpvRecordNature(recordTimestamp, activationValue);
    return Object.freeze({ recordTimestamp, recordNature });
}
