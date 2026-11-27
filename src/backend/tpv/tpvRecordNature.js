export function createTpvRecordMetadata({ createdAt = new Date() } = {}) {
    const recordTimestamp = new Date(createdAt);
    if (!Number.isFinite(recordTimestamp.getTime())) {
        throw new Error("TPV_RECORD_TIMESTAMP_INVALID");
    }
    return Object.freeze({ recordTimestamp });
}
