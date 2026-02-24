# Server-Side Conversion Tracking for Velogrej.dk

## Project Brief

Build a server-side conversion tracking system that receives Shopify webhooks and forwards conversion events to Google Ads, Meta, and GA4 — bypassing browser-side cookie consent limitations.

## Background & Problem

Velogrej.dk is a Danish cycling e-commerce store on Shopify. The Shopify automated cookie banner (GDPR/EU) completely blocks Google's tracking tag from loading until a visitor explicitly accepts cookies. This means:

- Google Ads only tracks ~13% of actual conversions (3 tracked vs 23 real purchases in a 30-day period)
- Shopify's own attribution is similarly broken
- Smart bidding strategies can't work (PMax campaign performed poorly due to insufficient conversion data)
- The store runs a Google Shopping campaign (standard, manual CPC) as its primary ad channel

The root cause: Shopify's automated cookie banner does a hard block on the Google tag instead of initializing it in Consent Mode v2's "denied" mode. The `dataLayer` object doesn't even exist until cookies are accepted.

## Solution Architecture

A Docker container running behind Traefik on the store owner's Ubuntu server that:

1. **Receives Shopify webhooks** for the full conversion funnel
2. **Extracts gclid/fbclid** from Shopify's `landing_site` field
3. **Forwards events** to Google Ads Conversion API, Meta Conversions API, and GA4 Measurement Protocol

### Webhook Topics to Subscribe

| Shopify Webhook | Maps To | Purpose |
|---|---|---|
| `carts/create` | `add_to_cart` | Upper funnel |
| `carts/update` | `add_to_cart` | Cart modifications |
| `checkouts/create` | `begin_checkout` | Mid funnel |
| `checkouts/update` | `begin_checkout` | Checkout progress |
| `orders/paid` | `purchase` | Conversion (critical) |

### Server Components

1. **HTTPS Endpoint** (`ss.velogrej.dk`) — receives webhooks, verifies Shopify HMAC signatures
2. **Event Processor** — normalises webhook data into standard conversion events
3. **Click ID Store** (SQLite or Redis) — maps checkout/order tokens to gclid values extracted from `landing_site`
4. **Event Dispatcher** — forwards to:
   - Google Ads Conversion API (gclid matching)
   - Meta Conversions API (fbclid matching) — for future use
   - GA4 Measurement Protocol

### Infrastructure

- **Server**: Ubuntu, Docker, Traefik reverse proxy (already running other containers)
- **Subdomain**: `ss.velogrej.dk` (needs DNS + Traefik config)
- **No browser-side code required** — all server-to-server

## Google Ads Account Details

- **Account**: Velogrej.dk — Customer ID: 708-184-1500
- **Active campaign**: "Shopping campaign (Denmark)" — Standard Shopping, Manual CPC with eCPC, 150 DKK/day budget
- **Google Merchant Center**: 5338463877
- **Google Analytics**: G-QPNTKQSB73
- **Google Tag**: GT-TNC4FL7W
- **Google Ads conversion action**: "Google Shopping App Purchase" (WEBPAGE type, data-driven attribution, 90-day lookback)

## Shopify Details

- **Store**: velogrej.dk
- **Google & YouTube app**: Connected with Merchant Center, Google Ads, GA4, Google Business Profile
- **Enhanced conversions**: Enabled
- **Cookie banner**: Automated, active in 27 EU regions — THIS IS THE PROBLEM
- **Webhooks**: Can be registered via Settings → Notifications, or via GraphQL Admin API

## Key Considerations

- **GDPR/EU compliance**: The server-side webhook approach is server-to-server and doesn't involve storing anything on the user's device. The gclid is captured by Shopify natively in the `landing_site` field. Consent considerations apply mainly to the initial click ID capture, which Shopify handles as part of standard URL processing.
- **Verify that `landing_site` (with gclid) is available** in cart and checkout webhook payloads, not just order webhooks. If only available on orders, we retroactively attribute funnel events.
- **Webhook signature verification** is critical — use Shopify's HMAC-SHA256 signing to validate all incoming webhooks.
- **Webhooks must respond with HTTP 200 quickly** — do heavy processing asynchronously.

## Phase Plan

1. **Phase 1**: Docker container with webhook receiver, HMAC verification, event logging
2. **Phase 2**: Click ID extraction and storage (gclid from landing_site)
3. **Phase 3**: Google Ads Conversion API integration
4. **Phase 4**: GA4 Measurement Protocol integration
5. **Phase 5**: Meta Conversions API integration (when ready for Meta ads)

## To Get Started

- Choose language (Node.js or Python)
- Create a Shopify custom app for Admin API access (needed for webhook signature verification)
- Set up DNS for `ss.velogrej.dk` pointing to the server
- Create Docker container with Traefik labels
- Register webhooks via Shopify admin (Settings → Notifications → Webhooks)
