# Payment as a Service Epic

## Epic Goal
Enable Flocci to act as a shared payment platform for multiple external apps, where partner apps can request payment collection, users complete payment via gateway, and partner apps receive reliable payment outcomes.

## Background
The current payment flow already supports:
- Dynamic callback URLs (`surl`, `furl`, `curl`) with allowlist validation.
- Transaction status lookup by `txnid`.
- PayU hash verification on callback handling.

This epic formalizes and extends that flow into a robust multi-app Payment as a Service (PaaS) capability.

## Problem Statement
External apps need a single, trusted payment orchestration layer that:
- Accepts payment initiation requests from multiple apps.
- Processes payments through PayU.
- Returns verified payment outcomes back to each calling app.
- Offers secure, auditable, and idempotent behavior across retries and failures.

## In Scope
- Multi-tenant app onboarding model for payment consumers.
- API-key or signed-request authentication per partner app.
- JSON-first payment initiation and redirect/session handling contract.
- Signed server-to-server outcome callbacks (webhooks) to partner apps.
- Status query API for reconciliation.
- Retry-safe idempotency and event logging.
- Operational visibility (monitoring, logs, alerting).

## Out of Scope
- Building a custom checkout UI from scratch.
- Supporting non-PayU gateways in this epic.
- Full settlement/payout engine to distribute funds to partners.

## Success Criteria
- 3+ partner apps can integrate without code changes in Flocci core flow.
- 99.9%+ reliable delivery of payment outcome events (with retry and dead-letter handling).
- End-to-end traceability for every transaction (`partner_ref` -> `txnid` -> final status).
- No unsigned callback accepted by partner verification flow.

## Proposed Product Model

### Partner Entity
Each partner app has:
- `partner_id`
- `partner_name`
- `status` (active, paused)
- `api_key_hash` (or asymmetric key reference)
- `webhook_url`
- `webhook_secret`
- `allowed_origins`
- `allowed_callback_hosts`

### Transaction Entity
Each transaction stores:
- `txnid` (Flocci generated)
- `partner_id`
- `partner_order_id`
- `amount`, `currency`
- `customer` details
- `gateway` details (PayU request + response)
- `status` lifecycle (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`)
- `idempotency_key`
- audit timestamps

## API Design (Target)

### 1) Create Payment Intent
`POST /api/payments/intents`

Request:
```json
{
  "partner_order_id": "order_12345",
  "amount": 999.0,
  "currency": "INR",
  "productinfo": "Workshop Seat",
  "customer": {
    "firstname": "Afsar",
    "email": "afsar@example.com",
    "phone": "+919876543210"
  },
  "redirect": {
    "success_url": "https://app.partner.com/payments/success",
    "failure_url": "https://app.partner.com/payments/failure",
    "cancel_url": "https://app.partner.com/payments/cancel"
  },
  "metadata": {
    "plan": "pro"
  }
}
```

Response:
```json
{
  "txnid": "flocci_txn_...",
  "status": "PENDING",
  "checkout": {
    "method": "redirect",
    "url": "https://secure.payu.in/_payment",
    "fields": {
      "key": "...",
      "txnid": "...",
      "hash": "..."
    }
  }
}
```

### 2) Payment Status
`GET /api/payments/status/{txnid}`

Behavior:
- Returns latest canonical status.
- Requires partner authentication.
- Returns only partner-owned transaction details.

### 3) Partner Webhook Delivery
Flocci sends `POST` to partner `webhook_url` on state changes.

Payload:
```json
{
  "event": "payment.completed",
  "txnid": "flocci_txn_...",
  "partner_order_id": "order_12345",
  "amount": 999.0,
  "currency": "INR",
  "status": "COMPLETED",
  "occurred_at": "2026-05-07T10:00:00Z"
}
```

Headers:
- `x-flocci-signature`: HMAC SHA-256 signature
- `x-flocci-timestamp`: UNIX timestamp

Partner verification logic must validate signature and replay window.

## Security Requirements
- Partner auth required for all partner-facing APIs.
- Secret values only stored hashed/encrypted at rest.
- Strict callback host allowlist validation.
- Signed webhook payloads with replay protection.
- Idempotency key support on create intent endpoint.
- Rate limiting by partner and IP.
- Principle of least privilege for admin and support access.

## Reliability Requirements
- At-least-once webhook delivery.
- Exponential backoff retries.
- Dead-letter queue for repeatedly failing webhook deliveries.
- Manual replay endpoint (admin-only).
- Strong audit trail for all payment lifecycle transitions.

## Observability
- Metrics:
  - payment intent creation rate
  - gateway success/failure rates
  - webhook success/retry/dead-letter counts
  - reconciliation mismatch counts
- Logs:
  - structured transaction logs with correlation IDs
- Alerts:
  - sustained webhook failure rate threshold
  - sudden drop in gateway success rate

## Migration Strategy

### Phase 1: Stabilize Current Flow
- Keep existing `/api/payments/initiate` route operational.
- Add partner ownership model to transaction records.
- Normalize status transitions and log model.

### Phase 2: Introduce Partner APIs
- Add `/api/payments/intents` with JSON-first contract.
- Add partner auth and idempotency.
- Keep backward compatibility for existing consumers.

### Phase 3: Signed Webhook Delivery
- Implement outbound webhook dispatcher with retries.
- Add replay-safe signing and partner verification guide.
- Add dead-letter and manual replay tooling.

### Phase 4: Production Hardening
- Add dashboards and SLO tracking.
- Complete runbooks and incident playbooks.
- Perform load and failure injection testing.

## Acceptance Criteria
- Partner app can initiate payment and receive completion outcome without manual intervention.
- Duplicate initiation with same idempotency key does not create duplicate transactions.
- Tampered webhook payload fails signature verification.
- Transaction status is queryable and consistent across API, logs, and database.
- Existing apps using current flow continue functioning during migration.

## Risks and Mitigations
- Risk: Incorrect callback or webhook endpoints.
  - Mitigation: strict allowlists, partner onboarding validation checks.
- Risk: Duplicate updates due to retries.
  - Mitigation: idempotency keys and monotonic status transition rules.
- Risk: Fraudulent callback/webhook traffic.
  - Mitigation: hash/signature verification, replay windows, rate limits.

## Open Questions
- Should partner auth use static API keys first, then migrate to signed JWT?
- Do we need per-partner custom branding/checkout behavior in this epic?
- Should partial payments or split payments be considered now or deferred?
- Is settlement/reporting to partner finance teams part of next epic?

## Definition of Done
- API contracts documented and versioned.
- Partner onboarding checklist published.
- Test suite includes unit, integration, and callback/webhook verification tests.
- Monitoring dashboards and alerts configured.
- Runbook available for support and incident handling.