#!/usr/bin/env node

// Upload missed Google Ads conversions for orders with gclids that were never attributed.
// The server-side GTM app was broken due to: API v17 sunset, API not enabled, wrong conversion action.
//
// Usage: node scripts/upload-missed-conversions.js
//
// Requires env vars (sourced from server .env or set manually):
//   GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN,
//   GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_CONVERSION_ACTION

const { GoogleAdsApi } = require('google-ads-api');

const conversions = [
  {
    label: '#1389',
    order_id: '7433417326925',
    gclid: 'CjwKCAjw687NBhB4EiwAQ645drfWF7WU0nq5T4MGyQUX__yaa0SEy2mcFZxM-vaxYM-UVhESAHYDzRoCl88QAvD_BwE',
    value: 328,
    currency: 'DKK',
    conversion_date_time: '2026-03-13 20:31:51+00:00',
  },
  {
    label: '#1380',
    order_id: '7404218974541',
    gclid: 'Cj0KCQiA5I_NBhDVARIsAOrqIsYQcSkElpZ-ZHRy4ipaj5x87OIx68gQxM8s_9-bZv8YaF19vMMu6BMaAl7iEALw_wcB',
    value: 449,
    currency: 'DKK',
    conversion_date_time: '2026-03-01 14:42:51+00:00',
  },
  {
    label: '#1379',
    order_id: '7401907716429',
    gclid: 'Cj0KCQiAwYrNBhDcARIsAGo3u33MZEOaAzszLvQ3Iislys320u5dJc4_nsJMJrX-e58wx9s-Cx0xw98aAj1kEALw_wcB',
    value: 148,
    currency: 'DKK',
    conversion_date_time: '2026-02-28 12:14:07+00:00',
  },
];

async function main() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const conversionAction = process.env.GOOGLE_ADS_CONVERSION_ACTION;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerId || !conversionAction) {
    console.error('Missing required GOOGLE_ADS_* environment variables');
    process.exit(1);
  }

  const api = new GoogleAdsApi({ client_id: clientId, client_secret: clientSecret, developer_token: developerToken });
  const customer = api.Customer({ customer_id: customerId, refresh_token: refreshToken });

  for (const c of conversions) {
    try {
      const result = await customer.conversionUploads.uploadClickConversions({
        customer_id: customerId,
        conversions: [{
          gclid: c.gclid,
          conversion_action: conversionAction,
          conversion_date_time: c.conversion_date_time,
          conversion_value: c.value,
          currency_code: c.currency,
          order_id: c.order_id,
        }],
        partial_failure: true,
      });

      if (result.partial_failure_error) {
        console.log(`FAILED  ${c.label} (${c.order_id}): ${result.partial_failure_error.message}`);
      } else {
        console.log(`SUCCESS ${c.label} (${c.order_id}): ${c.value} ${c.currency}`);
      }
    } catch (err) {
      console.error(`ERROR   ${c.label} (${c.order_id}): ${err.message}`);
    }
  }
}

main();
