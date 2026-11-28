import wixFetch from "wix-fetch";
import { getSecretValue } from "backend/secretAccess";
import { hashSHA256 } from "backend/securityEngine";
import { serializeQuarterlyRegistryContent } from "backend/exports/exportContract";
import { SECRETS } from "backend/mmSecrets";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

/** Checks secret presence without returning or logging any secret value. */
export async function getSharePointConfigurationStatus() {
    const requiredNames = [
        SECRETS.GRAPH_TENANT_ID,
        SECRETS.GRAPH_CLIENT_ID,
        SECRETS.GRAPH_CLIENT_SECRET,
        SECRETS.GRAPH_SITE_ID,
        SECRETS.GRAPH_DRIVE_ID,
        SECRETS.GRAPH_FOLDER_PATH,
    ];
    const checks = await Promise.all(requiredNames.map(async (name) => {
        try {
            const value = await getSecretValue(name);
            return typeof value === "string" && value.trim().length > 0;
        } catch (_) {
            return false;
        }
    }));
    return {
        configured: checks.every(Boolean),
        missingSecrets: requiredNames.filter((name, index) => !checks[index]),
    };
}

function fail(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

async function secret(name) {
    try {
        return await getSecretValue(name);
    } catch (_) {
        throw fail("C3_GRAPH_CONFIGURATION_UNAVAILABLE");
    }
}

async function readJson(response, errorCode) {
    let body = null;
    try {
        const text = await response.text();
        body = text ? JSON.parse(text) : {};
    } catch (_) {
        body = {};
    }
    if (!response.ok) throw fail(errorCode);
    return body;
}

async function graphRequest(url, token, options = {}, errorCode = "C3_GRAPH_REQUEST_FAILED") {
    let response;
    try {
        response = await wixFetch.fetch(url, {
            ...options,
            headers: {
                Authorization: "Bearer " + token,
                Accept: "application/json",
                ...(options.headers || {}),
            },
        });
    } catch (_) {
        throw fail("C3_GRAPH_DELIVERY_OUTCOME_UNCERTAIN");
    }
    return { response, body: await readJson(response, errorCode) };
}

function encodePath(path) {
    return String(path || "").split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export async function uploadAndVerifySharePointPackage(artifact) {
    if (!artifact?.manifest || !artifact?.content) throw fail("C3_GRAPH_ARTIFACT_INVALID");

    const [tenantId, clientId, clientSecret, siteId, driveId, folderPath] = await Promise.all([
        secret(SECRETS.GRAPH_TENANT_ID),
        secret(SECRETS.GRAPH_CLIENT_ID),
        secret(SECRETS.GRAPH_CLIENT_SECRET),
        secret(SECRETS.GRAPH_SITE_ID),
        secret(SECRETS.GRAPH_DRIVE_ID),
        secret(SECRETS.GRAPH_FOLDER_PATH),
    ]);
    const normalizedFolderPath = String(folderPath || "").trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedFolderPath || normalizedFolderPath.split("/").some((part) =>
        !part || part === "." || part === ".." || part.includes("\\") || part.includes(":")
    )) throw fail("C3_GRAPH_FOLDER_PATH_INVALID");

    const serialized = serializeQuarterlyRegistryContent(artifact.content);
    const expectedChecksum = await hashSHA256(serialized);
    if (expectedChecksum !== artifact.manifest.contentChecksum) throw fail("C3_GRAPH_ARTIFACT_CHECKSUM_MISMATCH");

    const tokenResponse = await wixFetch.fetch(
        "https://login.microsoftonline.com/" + encodeURIComponent(tenantId) + "/oauth2/v2.0/token",
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                scope: "https://graph.microsoft.com/.default",
                grant_type: "client_credentials",
            }).toString(),
        }
    ).catch(() => { throw fail("C3_GRAPH_AUTH_UNAVAILABLE"); });
    const tokenData = await readJson(tokenResponse, "C3_GRAPH_AUTH_FAILED");
    const token = typeof tokenData.access_token === "string" ? tokenData.access_token : "";
    if (!token) throw fail("C3_GRAPH_AUTH_FAILED");

    const site = await graphRequest(
        GRAPH_ROOT + "/sites/" + encodeURIComponent(siteId) + "/drive",
        token,
        { method: "GET" },
        "C3_GRAPH_SITE_ACCESS_DENIED"
    );
    if (site.body?.id !== driveId) throw fail("C3_GRAPH_DRIVE_SITE_MISMATCH");

    const fileName = artifact.manifest.exportId + "-" + artifact.manifest.artifactId + ".json";
    const relativePath = [normalizedFolderPath, fileName].join("/");
    const encodedPath = encodePath(relativePath);
    const itemUrl = GRAPH_ROOT + "/drives/" + encodeURIComponent(driveId) + "/root:/" + encodedPath;
    const uploadUrl = itemUrl + ":/content?%40microsoft.graph.conflictBehavior=fail";

    let item;
    let alreadyExisted = false;
    let uploadResponse;
    try {
        uploadResponse = await wixFetch.fetch(uploadUrl, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json; charset=utf-8",
                Accept: "application/json",
            },
            body: serialized,
        });
        if (uploadResponse.status === 409 || uploadResponse.status === 412) {
            alreadyExisted = true;
        } else {
            item = await readJson(uploadResponse, "C3_GRAPH_UPLOAD_FAILED");
        }
    } catch (error) {
        if (error?.code) throw error;
        throw fail("C3_GRAPH_DELIVERY_OUTCOME_UNCERTAIN");
    }

    if (alreadyExisted) {
        const existing = await graphRequest(itemUrl, token, { method: "GET" }, "C3_GRAPH_EXISTING_ITEM_READ_FAILED");
        item = existing.body;
    }
    if (!item?.id) throw fail("C3_GRAPH_ITEM_ID_MISSING");

    let readback;
    try {
        const response = await wixFetch.fetch(
            GRAPH_ROOT + "/drives/" + encodeURIComponent(driveId) + "/items/" + encodeURIComponent(item.id) + "/content",
            { method: "GET", headers: { Authorization: "Bearer " + token } }
        );
        if (!response.ok) throw fail("C3_GRAPH_READBACK_FAILED");
        readback = await response.text();
    } catch (error) {
        if (error?.code) throw error;
        throw fail("C3_GRAPH_READBACK_FAILED");
    }

    const readbackChecksum = await hashSHA256(readback);
    if (readbackChecksum !== expectedChecksum) throw fail("C3_GRAPH_READBACK_CHECKSUM_MISMATCH");

    return {
        itemId: String(item.id),
        webUrl: typeof item.webUrl === "string" ? item.webUrl : null,
        fileName,
        contentChecksum: expectedChecksum,
        responseStatus: alreadyExisted ? 200 : uploadResponse.status,
        alreadyExisted,
    };
}
