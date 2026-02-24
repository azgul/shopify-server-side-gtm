const crypto = require('crypto');
const eventProcessor = require('./event-processor');
const ga4 = require('./ga4');
const googleAds = require('./google-ads');
const logger = require('./logger');

function verifyHmac(rawBody, hmacHeader, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader || '');

  if (digestBuffer.length !== headerBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

function createHandler() {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  return (req, res) => {
    const hmac = req.get('X-Shopify-Hmac-SHA256');
    const topic = req.get('X-Shopify-Topic');

    if (!secret || !verifyHmac(req.body, hmac, secret)) {
      logger.warn('Webhook HMAC verification failed', { topic });
      res.status(401).send('Unauthorized');
      return;
    }

    // Respond immediately so Shopify doesn't retry
    res.status(200).send('OK');

    // Process asynchronously
    processWebhook(topic, req.body).catch((err) => {
      logger.error('Webhook processing failed', {
        topic,
        error: err.message,
      });
    });
  };
}

async function processWebhook(topic, rawBody) {
  const payload = JSON.parse(rawBody);

  logger.info('Webhook received', {
    topic,
    id: payload.id,
    email: payload.email ? '***' : null,
  });

  const event = eventProcessor.process(topic, payload);
  if (!event) return;

  // Send to both GA4 and Google Ads in parallel
  await Promise.allSettled([
    ga4.send(event),
    googleAds.uploadConversion(event),
  ]);
}

module.exports = { createHandler };
