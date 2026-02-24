const clickStore = require('./click-store');
const logger = require('./logger');

const TOPIC_MAP = {
  'carts/create': 'add_to_cart',
  'carts/update': 'add_to_cart',
  'checkouts/create': 'begin_checkout',
  'checkouts/update': 'begin_checkout',
  'orders/paid': 'purchase',
};

function extractGclid(landingSite) {
  if (!landingSite) return null;
  try {
    const url = new URL(landingSite, 'https://placeholder.com');
    return url.searchParams.get('gclid') || null;
  } catch {
    return null;
  }
}

function normalizeItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];
  return lineItems.map((item) => ({
    item_id: String(item.product_id || item.id || ''),
    item_name: item.title || item.name || '',
    quantity: item.quantity || 1,
    price: parseFloat(item.price) || 0,
    item_variant: item.variant_title || '',
  }));
}

function process(topic, payload) {
  const eventName = TOPIC_MAP[topic];
  if (!eventName) {
    logger.warn('Unknown webhook topic', { topic });
    return null;
  }

  const gclid = extractGclid(payload.landing_site);

  // Store gclid under all available tokens so order lookups succeed
  if (gclid) {
    const tokens = [
      payload.checkout_token,
      payload.cart_token,
      payload.token,
    ].filter(Boolean);

    for (const token of tokens) {
      clickStore.storeGclid(token, gclid);
    }

    logger.info('Stored gclid', { gclid, tokens, topic });
  }

  // For orders, try to recover gclid from stored tokens if not on payload
  let resolvedGclid = gclid;
  if (!resolvedGclid && eventName === 'purchase') {
    resolvedGclid =
      clickStore.lookupGclid(payload.checkout_token) ||
      clickStore.lookupGclid(payload.cart_token) ||
      clickStore.lookupGclid(payload.token);

    if (resolvedGclid) {
      logger.info('Recovered gclid from click store', {
        gclid: resolvedGclid,
        order_id: payload.id,
      });
    }
  }

  const lineItems = payload.line_items || [];
  const totalPrice = parseFloat(payload.total_price) || 0;
  const currency = (payload.currency || 'DKK').toUpperCase();

  const event = {
    event_name: eventName,
    gclid: resolvedGclid,
    order_id: payload.id ? String(payload.id) : null,
    order_name: payload.name || null,
    email: payload.email || payload.customer?.email || null,
    currency,
    value: totalPrice,
    items: normalizeItems(lineItems),
    token: payload.checkout_token || payload.cart_token || payload.token || null,
    created_at: payload.created_at || new Date().toISOString(),
  };

  logger.info('Event processed', {
    event_name: event.event_name,
    order_id: event.order_id,
    has_gclid: !!event.gclid,
    value: event.value,
    currency: event.currency,
  });

  return event;
}

module.exports = { process, extractGclid };
