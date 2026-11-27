/**
 * Neutral server timestamp metadata for all TPV records.
 * Runtime, test and production use the same schema; no record is classified
 * as real, synthetic or simulated.
 */
export async function createTpvRecordMetadata() {
    return Object.freeze({ recordTimestamp: new Date() });
}
