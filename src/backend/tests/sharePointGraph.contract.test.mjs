import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const graphSource = await readFile(new URL("../exports/sharePointGraph.js", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../exports/exportService.web.js", import.meta.url), "utf8");
const outboxSource = await readFile(new URL("../exports/integrationOutbox.js", import.meta.url), "utf8");

test("C3 SharePoint transport uses Wix backend fetch and server-side Secrets Manager only", () => {
    assert.match(graphSource, /import wixFetch from "wix-fetch"/);
    assert.match(graphSource, /getSecretValue\(name\)/);
    assert.match(graphSource, /SECRETS\.GRAPH_CLIENT_SECRET/);
    assert.doesNotMatch(graphSource, /client_secret\s*:\s*["'][^"']+["']/);
    assert.doesNotMatch(graphSource, /access_token\s*:\s*["'][^"']+["']/);
});

test("C3 SharePoint delivery prevents overwrite and verifies downloaded bytes by SHA-256", () => {
    assert.match(graphSource, /conflictBehavior=fail/);
    assert.match(graphSource, /C3_GRAPH_DRIVE_SITE_MISMATCH/);
    assert.match(graphSource, /\/items\/.*\/content/);
    assert.match(graphSource, /hashSHA256\(readback\)/);
    assert.match(graphSource, /C3_GRAPH_READBACK_CHECKSUM_MISMATCH/);
    assert.match(graphSource, /part === "\.\."/);
});

test("C3 delivery rebuilds the artifact from fiscal SSOT and appends a verified event", () => {
    assert.match(serviceSource, /export const deliverExternalRegistryPackage = webMethod/);
    assert.match(serviceSource, /getC3ArtifactEvents\(artifactId\)/);
    assert.match(serviceSource, /artifact\.manifest\.contentChecksum !== events\.prepared\.payload\?\.contentChecksum/);
    assert.match(serviceSource, /uploadAndVerifySharePointPackage\(artifact\)/);
    assert.match(serviceSource, /appendC3VerifiedEvent/);
    assert.match(outboxSource, /eventType: "C3_PACKAGE_VERIFIED"/);
    assert.match(outboxSource, /deliveryStatus: "VERIFIED"/);
});
