const { GoogleAdsApi } = require('google-ads-api');
const logger = require('./logger');

let client;
let customer;

function init() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerId) {
    logger.warn('Google Ads not fully configured, uploads will be skipped');
    return;
  }

  client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  customer = client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
  });

  logger.info('Google Ads client initialized', { customer_id: customerId });
}

async function uploadConversion(event, { validateOnly = false } = {}) {
  if (!customer) {
    logger.warn('Google Ads client not initialized, skipping upload');
    return null;
  }

  if (event.event_name !== 'purchase') {
    return null;
  }

  if (!event.gclid) {
    logger.info('No gclid for order, skipping Google Ads upload', {
      order_id: event.order_id,
    });
    return null;
  }

  const conversionAction = process.env.GOOGLE_ADS_CONVERSION_ACTION;
  if (!conversionAction) {
    logger.warn('GOOGLE_ADS_CONVERSION_ACTION not set, skipping upload');
    return null;
  }

  const conversion = {
    gclid: event.gclid,
    conversion_action: conversionAction,
    conversion_date_time: formatDateTime(event.created_at),
    conversion_value: event.value,
    currency_code: event.currency,
    order_id: event.order_id,
  };

  try {
    const result = await customer.conversionUploads.uploadClickConversions({
      conversions: [conversion],
      partial_failure: true,
      validate_only: validateOnly,
    });

    logger.info('Google Ads conversion uploaded', {
      order_id: event.order_id,
      gclid: event.gclid,
      value: event.value,
      validate_only: validateOnly,
      partial_failure_error: result.partial_failure_error || null,
    });

    return result;
  } catch (err) {
    logger.error('Google Ads upload failed', {
      order_id: event.order_id,
      error: err.message,
      details: err.errors?.[0]?.message || null,
    });
    return null;
  }
}

function formatDateTime(isoString) {
  // Google Ads expects "yyyy-mm-dd hh:mm:ss+|-hh:mm"
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+00:00`
  );
}

module.exports = { init, uploadConversion };
