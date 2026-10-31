import assert from "node:assert/strict";
import { cartV2 } from "@wix/ecom";
import { items } from "@wix/data";

const requiredCartMethods = ["createCart", "calculateCart", "getCheckoutUrl"];
for (const method of requiredCartMethods) {
    assert.equal(
        typeof cartV2?.[method],
        "function",
        `@wix/ecom cartV2.${method} must be exported by the installed SDK`
    );
}

assert.equal(
    typeof items?.patch,
    "function",
    "@wix/data items.patch must be exported by the installed SDK"
);

assert.equal(
    typeof items?.bulkPatch,
    "function",
    "@wix/data items.bulkPatch must be exported by the installed SDK"
);

process.stdout.write(
    `Wix SDK contracts OK: @wix/ecom cartV2.${requiredCartMethods.join(", cartV2.")}; @wix/data items.patch, items.bulkPatch\n`
);
