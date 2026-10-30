import test from 'node:test';
import assert from 'node:assert/strict';

const { mocks } = await import('./loader.mjs');
const core = await import('../booking/bookingCore.js');

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const CART_ID = '22222222-2222-4222-8222-222222222222';
const BOOKINGS_CATALOG_APP_ID = '13d21c63-b5ec-5912-8397-c3a5ddb27a97';

function setCartV2Mock(namespace) {
  mocks.sdk['@wix/ecom::cartV2'] = namespace;
}

test('CARTV2-01 creates a visitor WEB cart from the Bookings booking ID and returns a calculated checkout URL', async () => {
  const calls = [];
  setCartV2Mock({
    createCart: async (options) => {
      calls.push({ method: 'createCart', options });
      return { cart: { _id: CART_ID } };
    },
    calculateCart: async (cartId, options) => {
      calls.push({ method: 'calculateCart', cartId, options });
      return {
        cart: {
          _id: CART_ID,
          businessInfo: { currencyCode: 'EUR' },
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

  const result = await core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-1');

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
    createCart: async () => ({ cart: { _id: CART_ID } }),
    calculateCart: async () => ({
      cart: { _id: CART_ID, businessInfo: { currencyCode: 'EUR' } },
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
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-2'),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(checkoutUrlCalls, 0);
});

test('CARTV2-03 rejects an invalid booking ID before creating a cart', async () => {
  let createCartCalls = 0;
  setCartV2Mock({
    createCart: async () => {
      createCartCalls += 1;
      return { cart: { _id: CART_ID } };
    },
  });

  await assert.rejects(
    core.createBookingCartCheckout('not-a-guid', 'trace-cart-3'),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
  assert.equal(createCartCalls, 0);
});

test('CARTV2-04 rejects incomplete or mismatched calculation responses', async () => {
  setCartV2Mock({
    createCart: async () => ({ cart: { _id: CART_ID } }),
    calculateCart: async () => ({
      cart: { _id: '33333333-3333-4333-8333-333333333333', businessInfo: { currencyCode: 'EUR' } },
      summary: {
        violations: [],
        priceSummary: { total: { amount: '48.50' } },
      },
    }),
    getCheckoutUrl: async () => ({ checkoutUrl: 'https://checkout.wix.com/cart/abc123' }),
  });

  await assert.rejects(
    core.createBookingCartCheckout(BOOKING_ID, 'trace-cart-4'),
    (error) => error && error.code === 'CHECKOUT_FAILED'
  );
});
