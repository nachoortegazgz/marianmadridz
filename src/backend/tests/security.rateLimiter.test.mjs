import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { rateLimiter } from "../security.js";
import { wixDataMock } from "./loader.mjs";

const originalDateNow = Date.now;
let fixedNow = Date.UTC(2026, 9, 31, 12, 0, 0);

beforeEach(() => {
    wixDataMock._reset();
    Date.now = () => fixedNow;
});

afterEach(() => {
    Date.now = originalDateNow;
});

test("SEC-RL-01 persists a burst-capable GCRA counter and enforces retryAfter", async () => {
    const key = { surface: "security.test", key: "requester-a" };

    assert.deepEqual(
        await rateLimiter(key, 2, 10000),
        { allowed: true, retryAfter: 0 }
    );
    assert.deepEqual(
        await rateLimiter(key, 2, 10000),
        { allowed: true, retryAfter: 0 }
    );

    const blocked = await rateLimiter(key, 2, 10000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfter, 5);

    const rows = wixDataMock._store.get("ControlOperativo") || [];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].controlType, "RATE_LIMIT");
    assert.equal(rows[0].requestCount, 2);
    assert.equal(rows[0].version, 2);
    assert.equal(rows[0].payload.algorithm, "GCRA_V1");
});

test("SEC-RL-02 refills at the configured interval after the burst", async () => {
    const key = { surface: "security.test", key: "requester-refill" };

    assert.equal((await rateLimiter(key, 2, 10000)).allowed, true);
    assert.equal((await rateLimiter(key, 2, 10000)).allowed, true);
    assert.equal((await rateLimiter(key, 2, 10000)).allowed, false);

    fixedNow += 5000;
    assert.equal((await rateLimiter(key, 2, 10000)).allowed, true);
    assert.equal((await rateLimiter(key, 2, 10000)).allowed, false);
});

test("SEC-RL-03 isolates requesters and policy surfaces", async () => {
    const requesterA = { surface: "security.test", key: "requester-a" };
    const requesterB = { surface: "security.test", key: "requester-b" };
    const otherSurface = { surface: "security.other", key: "requester-a" };

    assert.equal((await rateLimiter(requesterA, 1, 10000)).allowed, true);
    assert.equal((await rateLimiter(requesterA, 1, 10000)).allowed, false);
    assert.equal((await rateLimiter(requesterB, 1, 10000)).allowed, true);
    assert.equal((await rateLimiter(otherSurface, 1, 10000)).allowed, true);
});

test("SEC-RL-04 applies canonical policies for public booking surfaces", async () => {
    const publicBooking = { surface: "public-booking", key: "public-a" };
    for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await rateLimiter(publicBooking)).allowed, true);
    }
    assert.equal((await rateLimiter(publicBooking)).allowed, false);

    const reservas = { surface: "reservas", key: "reservas-a" };
    for (let attempt = 0; attempt < 20; attempt += 1) {
        assert.equal((await rateLimiter(reservas)).allowed, true);
    }
    assert.equal((await rateLimiter(reservas)).allowed, false);

    const availability = { surface: "availability", key: "availability-a" };
    for (let attempt = 0; attempt < 12; attempt += 1) {
        assert.equal((await rateLimiter(availability)).allowed, true);
    }
    assert.equal((await rateLimiter(availability)).allowed, false);
});

test("SEC-RL-05 atomic compare-and-set admits no more than the configured burst under concurrency", async () => {
    const key = { surface: "public-booking", key: "parallel-requester" };
    const outcomes = await Promise.all(
        Array.from({ length: 25 }, () => rateLimiter(key))
    );

    assert.equal(outcomes.filter((result) => result.allowed).length, 5);
    assert.equal(outcomes.filter((result) => !result.allowed).length, 20);

    const rows = wixDataMock._store.get("ControlOperativo") || [];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].requestCount, 5);
    assert.equal(rows[0].version, 5);
});
