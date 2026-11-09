import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { mocks } = await import('./loader.mjs');
const core = await import('../booking/bookingCore.js');

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const CART_ID = '22222222-2222-4222-8222-222222222222';
const BOOKINGS_CATALOG_APP_ID = '13d21c63-b5ec-5912-8397-c3a5ddb27a97';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const CONTACT_ID = '44444444-4444-4444-8444-444444444444';
const MEMBER_IDENTITY = { memberId: MEMBER_ID, contactId: CONTACT_ID };
const OWNED_CART = { memberId: MEMBER_ID, contactId: CONTACT_ID, openAccess: false };

function setCartV2Mock(namespace) {
  mocks.sdk['@wix/ecom::cartV2'] = {
    deleteCart: async () => ({}),
    ...namespace,
  };
}

function validBookingLineItems(bookingId = BOOKING_ID, status = 'IN_STOCK') {
  return [{
    source: {
      catalogReference: {
        appId: BOOKINGS_CATALOG_APP_ID,
        catalogItemId: bookingId,
      },
    },
    status,
  }];
}

test('CARTV2-01 creates a member-owned WEB cart from the Bookings booking ID and returns a calculated checkout URL', async () => {
  const calls = [];
  setCartV2Mock({
    createCart: async (options) => {
      calls.push({ method: 'createCart', options });
      return { _id: CART_ID, customerInfo: OWNED_CART };
    },
    calculateCart: async (cartId, options) => {
      calls.push({ method: 'calculateCart', cartId, options });
      return {
        cart: {
          _id: CART_ID,
          businessInfo: { currencyCode: 'EUR' },
          lineItems: validBookingLineItems(),
        },
        summary: {
          violations: [],
          priceSummary: { total: { amount: '48.50' } },
        },
      };
    },
    getCheckoutUrl: async (cartId) => {
      calls.push({ method: 'getCheckoutUrl', cartId });
      return { checkoutUrl: 'https://checkout.wix.com/cart/abc123' };
    },
  });

  const result = await core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-1', MEMBER_IDENTITY);

  assert.deepEqual(result, {
    cartId: CART_ID,
    checkoutUrl: 'https://checkout.wix.com/cart/abc123',
    totalAmount: '48.50',
    currencyCode: 'EUR',
  });
  assert.deepEqual(calls[0], {
    method: 'createCart',
    options: {
      cart: { source: { channelType: 'WEB' } },
      catalogItems: [{
        catalogReference: {
          appId: BOOKINGS_CATALOG_APP_ID,
          catalogItemId: BOOKING_ID,
        },
        quantity: 1,
      }],
    },
  });
  assert.deepEqual(calls[1], {
    method: 'calculateCart',
    cartId: CART_ID,
    options: { refreshCart: true },
  });
  assert.deepEqual(calls[2], {
    method: 'getCheckoutUrl',
    cartId: CART_ID,
  });
});

test('CARTV2-02 refuses to return a checkout URL when cart calculation has violations', async () => {
  let checkoutUrlCalls = 0;
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: { _id: CART_ID, businessInfo: { currencyCode: 'EUR' }, lineItems: validBookingLineItems() },
      summary: {
        violations: [{ code: 'BOOKING_ITEM_UNAVAILABLE' }],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => {
      checkoutUrlCalls += 1;
      return { checkoutUrl: 'https://checkout.wix.com/cart/should-not-be-called' };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-2', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(checkoutUrlCalls, 0);
});

test('CARTV2-03 rejects an invalid booking ID before creating a cart', async () => {
  let createCartCalls = 0;
  setCartV2Mock({
    createCart: async () => {
      createCartCalls += 1;
      return { _id: CART_ID, customerInfo: OWNED_CART };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout('not-a-guid', 'trace-cart-3', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(createCartCalls, 0);
});

test('CARTV2-04 rejects incomplete or mismatched calculation responses', async () => {
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: { _id: '33333333-3333-4333-8333-333333333333', businessInfo: { currencyCode: 'EUR' }, lineItems: validBookingLineItems() },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => ({ checkoutUrl: 'https://checkout.wix.com/cart/abc123' }),
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-4', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
});

test('CARTV2-05 accepts a valid calculation when optional violations are omitted', async () => {
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: {
        _id: CART_ID,
        businessInfo: { currencyCode: 'EUR' },
        lineItems: validBookingLineItems(),
      },
      summary: {
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => ({
      checkoutUrl: 'https://checkout.wix.com/cart/abc123',
    }),
  });

  const result = await core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-5', MEMBER_IDENTITY);
  assert.equal(result.cartId, CART_ID);
  assert.equal(result.checkoutUrl, 'https://checkout.wix.com/cart/abc123');
});

test('CARTV2-06 rejects malformed violations instead of treating them as absent', async () => {
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: { _id: CART_ID, businessInfo: { currencyCode: 'EUR' }, lineItems: validBookingLineItems() },
      summary: {
        violations: { code: 'INVALID_SHAPE' },
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => ({ checkoutUrl: 'https://checkout.wix.com/cart/abc123' }),
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-6', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
});

test('CARTV2-07 rejects invalid totals and currency before checkout URL retrieval', async (t) => {
  const invalidCases = [
    { total: '-1.00', currency: 'EUR' },
    { total: 'not-a-number', currency: 'EUR' },
    { total: '48.50', currency: 'EURO' },
  ];

  for (const [index, item] of invalidCases.entries()) {
    await t.test('invalid case ' + (index + 1), async () => {
      let checkoutUrlCalls = 0;
      setCartV2Mock({
        createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
        calculateCart: async () => ({
          cart: { _id: CART_ID, businessInfo: { currencyCode: item.currency }, lineItems: validBookingLineItems() },
          summary: {
            violations: [],
            priceSummary: { total: { amount: item.total } },
          },
        }),
        getCheckoutUrl: async () => {
          checkoutUrlCalls += 1;
          return { checkoutUrl: 'https://checkout.wix.com/cart/abc123' };
        },
      });

      await assert.rejects(
        core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-7-' + index, MEMBER_IDENTITY),
        (error) => error && error.code === 'CHECKOUT_FAILED'
      );
      assert.equal(checkoutUrlCalls, 0);
    });
  }
});

test('CARTV2-08 rejects a non-HTTPS checkout URL', async () => {
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: { _id: CART_ID, businessInfo: { currencyCode: 'EUR' }, lineItems: validBookingLineItems() },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => ({ checkoutUrl: 'http://checkout.wix.com/cart/abc123' }),
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-8', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
});

test('CARTV2-09 rejects an empty calculated cart before returning checkout URL', async () => {
  let checkoutUrlCalls = 0;
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: {
        _id: CART_ID,
        businessInfo: { currencyCode: 'EUR' },
        lineItems: [],
      },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '0.00' } },
      },
    }),
    getCheckoutUrl: async () => {
      checkoutUrlCalls += 1;
      return { checkoutUrl: 'https://checkout.wix.com/cart/empty' };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-9', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(checkoutUrlCalls, 0);
});

test('CARTV2-10 rejects a calculated cart containing a different booking ID', async () => {
  let checkoutUrlCalls = 0;
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: {
        _id: CART_ID,
        businessInfo: { currencyCode: 'EUR' },
        lineItems: validBookingLineItems('33333333-3333-4333-8333-333333333333'),
      },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => {
      checkoutUrlCalls += 1;
      return { checkoutUrl: 'https://checkout.wix.com/cart/mismatch' };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-10', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(checkoutUrlCalls, 0);
});

test('CARTV2-11 rejects an unavailable Bookings line item', async () => {
  let checkoutUrlCalls = 0;
  setCartV2Mock({
    createCart: async () => ({ _id: CART_ID, customerInfo: OWNED_CART }),
    calculateCart: async () => ({
      cart: {
        _id: CART_ID,
        businessInfo: { currencyCode: 'EUR' },
        lineItems: validBookingLineItems(BOOKING_ID, 'OUT_OF_STOCK'),
      },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => {
      checkoutUrlCalls += 1;
      return { checkoutUrl: 'https://checkout.wix.com/cart/unavailable' };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-11', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(checkoutUrlCalls, 0);
});
test('CARTV2-12 refuses an open-access cart and deletes it before any checkout calculation', async () => {
  let calculateCalls = 0;
  let deleteCalls = 0;
  setCartV2Mock({
    createCart: async () => ({
      _id: CART_ID,
      customerInfo: { memberId: '', contactId: '', openAccess: true },
    }),
    calculateCart: async () => {
      calculateCalls += 1;
      return {};
    },
    deleteCart: async (cartId) => {
      assert.equal(cartId, CART_ID);
      deleteCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-12', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(calculateCalls, 0);
  assert.equal(deleteCalls, 1);
});

test('CARTV2-13 rejects a cart owned by a different member and deletes the orphan cart', async () => {
  let deleteCalls = 0;
  setCartV2Mock({
    createCart: async () => ({
      _id: CART_ID,
      customerInfo: {
        memberId: '55555555-5555-4555-8555-555555555555',
        contactId: CONTACT_ID,
        openAccess: false,
      },
    }),
    calculateCart: async () => {
      throw new Error('must not calculate a cart owned by another member');
    },
    deleteCart: async () => {
      deleteCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-13', MEMBER_IDENTITY),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(deleteCalls, 1);
});
test('CARTV2-14 requires member and contact identity before creating any cart', async () => {
  let createCalls = 0;
  setCartV2Mock({
    createCart: async () => {
      createCalls += 1;
      return { _id: CART_ID, customerInfo: OWNED_CART };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-14', {}),
    (error) => error && error.code === 'AUTH_REQUIRED'
  );
  assert.equal(createCalls, 0);
});

test('CARTV2-15 saga passes the authenticated member and contact IDs to the isolated booking cart', async () => {
  const sagaSource = await readFile(
    new URL('../booking/bookingSaga.js', import.meta.url),
    'utf8'
  );
  assert.match(
    sagaSource,
    /createBookingCartCheckout\(\s*bookingF1Id,\s*traceId,\s*\{\s*memberId:\s*sessionMemberId,\s*contactId:\s*sessionContactId/
  );
});
