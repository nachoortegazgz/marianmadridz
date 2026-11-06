/*
 * FACSIMIL-only fiscal artifact builder.
 * Isolated QA utility: no CMS writes, sequence allocation, signer calls,
 * QR generation, AEAT submission or production imports.
 */
import { hashChain, hashSHA256 } from "backend/securityEngine";

const PREFIX = "FACSIMIL-";
const SIGNATURE_PREFIX = "FACSIMIL-SIGNATURE-NOT-X509-";
const LABEL = "(SIMULACION PREVIA A DESPLIEGUE REAL)";
const GENESIS = "0".repeat(64);\nconst FACSIMIL_HASH_PATTERN = /^FACSIMIL-[0-9a-f]{64}$/;

function stableSerialize(value) {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableSerialize(value[key])}`
        ).join(",")}}`;
    }
    return JSON.stringify(value);
}

export async function createFiscalFacsimile({
    sequenceNumber, yearSequence, year, previousRecordHash = null,
    payload, generatedAt = new Date(),
} = {}) {
    const globalSequence = Number(sequenceNumber);
    const annualSequence = Number(yearSequence);
    const fiscalYear = String(year ?? new Date(generatedAt).getFullYear());
    if (!Number.isSafeInteger(globalSequence) || globalSequence < 1) throw new Error("FACSIMIL_SEQUENCE_NUMBER_INVALID");
    if (!Number.isSafeInteger(annualSequence) || annualSequence < 1) throw new Error("FACSIMIL_YEAR_SEQUENCE_INVALID");
    if (!/^20\\d{2}$/.test(fiscalYear)) throw new Error("FACSIMIL_YEAR_INVALID");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("FACSIMIL_PAYLOAD_INVALID");

    const numSerieFactura = `FACSIMIL-FAC-${fiscalYear}-${String(annualSequence).padStart(5, "0")}`;
    const previousHash = previousRecordHash == null ? `${PREFIX}${GENESIS}` : String(previousRecordHash).trim();
    if (!FACSIMIL_HASH_PATTERN.test(previousHash)) throw new Error("FACSIMIL_PREVIOUS_HASH_MUST_BE_FACSIMIL");

    const canonicalPayload = [
        "FACSIMIL=1",
        `NumSerieFactura=${numSerieFactura}`,
        `SequenceNumber=${globalSequence}`,
        `FechaHoraHusoGenRegistro=${new Date(generatedAt).toISOString()}`,
        `HuellaAnterior=${previousHash}`,
        `Payload=${stableSerialize(payload)}`,
        LABEL,
    ].join("&");

    const digest = await hashChain(previousHash, canonicalPayload);
    const hash = `${PREFIX}${digest}`;
    const signatureDigest = await hashSHA256(`FACSIMIL-NOT-X509|${numSerieFactura}|${digest}`);

    return Object.freeze({
        simulationMode: true,
        simulationMarker: "FACSIMIL",
        simulationLabel: LABEL,
        verifactuEligible: false,
        aeatSubmissionAllowed: false,
        sequenceNumber: globalSequence,
        yearSequence: annualSequence,
        numSerieFactura,
        previousRecordHash: previousHash,
        hash,
        digitalSignature: `${SIGNATURE_PREFIX}${signatureDigest}`,
        hashAlgorithm: "FACSIMIL-SHA-256",
        signatureAlgorithm: "FACSIMIL-NOT-X509",
        verificationQR: null,
        canonicalPayload,
        generatedAt: new Date(generatedAt).toISOString(),
    });
}

export async function verifyFiscalFacsimile(artifact) {
    try {
        if (
            artifact?.simulationMode !== true ||
            artifact?.simulationMarker !== "FACSIMIL" ||
            artifact?.verifactuEligible !== false ||
            artifact?.aeatSubmissionAllowed !== false ||
            artifact?.signatureAlgorithm !== "FACSIMIL-NOT-X509" ||
            artifact?.verificationQR !== null ||
            !FACSIMIL_HASH_PATTERN.test(String(artifact?.hash || "")) ||\n            !FACSIMIL_HASH_PATTERN.test(String(artifact?.previousRecordHash || "")) ||
            !String(artifact?.digitalSignature || "").startsWith(SIGNATURE_PREFIX)
        ) return false;

        const digest = await hashChain(artifact.previousRecordHash, artifact.canonicalPayload);
        if (artifact.hash !== `${PREFIX}${digest}`) return false;
        const signatureDigest = await hashSHA256(`FACSIMIL-NOT-X509|${artifact.numSerieFactura}|${digest}`);
        return artifact.digitalSignature === `${SIGNATURE_PREFIX}${signatureDigest}`;
    } catch (_) {
        return false;
    }
}

export const FISCAL_FACSIMILE_LABEL = LABEL;
