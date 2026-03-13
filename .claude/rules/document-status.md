# Document Status Transitions — Rules

## Single source of truth for status changes

- **All quote status changes** MUST go through `updateQuoteStatusUc()` — never call `updateQuoteStatus()` repository directly
- **All invoice status changes** MUST go through `updateInvoiceStatusUc()` — never call `updateInvoiceStatus()` repository directly
- These use-cases enforce: transition validation, document readiness validation (legal compliance), PDF freezing, avoir creation on paid cancellation

## Document readiness gate

When a document leaves `draft` status, `validateDocumentReady()` from `packages/core/src/modules/documents/domain/validate-document-ready.ts` is called automatically. This is the **single source of truth** for what makes a document legally valid.

**Never bypass this validation.** If a new mandatory field is added to French document requirements, add it to `validateDocumentReady()` — not scattered across use-cases.

### Currently enforced (bare minimum French legal):

**All documents (quotes + invoices):**
- Team name
- Team SIRET
- Team address
- Client address
- At least 1 line

**Invoices only (mandatory since 2013):**
- Early payment discount mention (`early_payment_discount`)
- Late penalty rate (`late_penalty_rate`)
- Recovery indemnity (`recovery_fee`)

## Rules for modifying status transition logic

1. **Never add status transition logic outside the use-case** — controllers, tools, and crons call the use-case, nothing else
2. **Never skip readiness validation** — if you need to transition a draft programmatically (e.g., `initialStatus` in create_document tool), it still goes through `updateInvoiceStatusUc`
3. **Add new readiness checks to `validateDocumentReady()` only** — add a test for each new check
4. **Error format**: `validateDocumentReady()` returns all errors at once (not fail-fast) so the UI can show everything that's missing
