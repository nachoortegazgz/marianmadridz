import assert from "node:assert/strict";
import { cartV2 } from "@wix/ecom";

const requiredMethods = ["createCart", "calculateCart", "getCheckoutUrl"];
for (const method of requiredMethods) {
    assert.equal(
        typeof cartV2?.[method],
        "function",
        `@wix/ecom cartV2.${method} must be exported by the installed SDK`
    );
}

process.stdout.write(
    `@wix/ecom Cart V2 SDK contract OK: ${requiredMethods.join(", ")}\n`
);
