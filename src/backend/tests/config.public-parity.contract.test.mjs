import test from "node:test";
import assert from "node:assert/strict";
import { SDK_CONFIG, SLOT_SEARCH, PAYMENT_METHOD } from "backend/internalConfig";
import { SITE, SLOT_SEARCH as PUBLIC_SLOT_SEARCH, PAYMENT_METHOD as PUBLIC_PAYMENT_METHOD } from "public/mmUtils";

test("CONFIG-PARITY-01 frontend-safe constants match backend canonical configuration", () => {
    assert.equal(SITE.TIMEZONE, SDK_CONFIG.TZ);
    assert.equal(SITE.CURRENCY, SDK_CONFIG.CURRENCY_CODE);
    assert.deepEqual(PUBLIC_SLOT_SEARCH, SLOT_SEARCH);
    assert.deepEqual(
        Object.values(PUBLIC_PAYMENT_METHOD).sort(),
        Object.values(PAYMENT_METHOD).sort()
    );
});
