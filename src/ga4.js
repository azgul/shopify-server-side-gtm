const crypto = require('crypto');
const logger = require('./logger');

const MP_URL = 'https://www.google-analytics.com/mp/collect';
const DEBUG_URL = 'https://www.google-analytics.com/debug/mp/collect';

function getClientId(event) {
  // Deterministic client_id from email or token fallback
  const seed = event.email || event.token || 'anonymous';
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 10)}.${Math.floor(new Date(event.created_at).getTime() / 1000)}`;
}

function buildPayload(event) {
  const gaEvent = {
    name: event.event_name,
    params: {
      currency: event.currency,
      value: event.value,
      items: event.items,
    },
  };

  if (event.event_name === 'purchase' && event.order_id) {
    gaEvent.params.transaction_id = event.order_id;
  }

  return {
    client_id: getClientId(event),
    non_personalized_ads: false,
    events: [gaEvent],
  };
}

async function send(event, { debug = false } = {}) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    logger.warn('GA4 not configured, skipping', { event_name: event.event_name });
    return null;
  }

  const baseUrl = debug ? DEBUG_URL : MP_URL;
  const url = `${baseUrl}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const body = buildPayload(event);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (debug) {
      const debugResponse = await response.json();
      logger.info('GA4 debug response', { response: debugResponse });
      return debugResponse;
    }

    // Non-debug MP collect always returns 2xx with empty body
    logger.info('GA4 event sent', {
      event_name: event.event_name,
      status: response.status,
      client_id: body.client_id,
    });

    return { status: response.status };
  } catch (err) {
    logger.error('GA4 send failed', {
      event_name: event.event_name,
      error: err.message,
    });
    return null;
  }
}

module.exports = { send };
