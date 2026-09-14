# Codex service tier accounting

CPA reports three independent values:

| Field | Meaning |
| --- | --- |
| `service_tier` in a raw CPA event | Client-requested tier |
| `effective_service_tier` | Final outbound request tier after translation and payload rules |
| `response_service_tier` | Tier reported by the upstream response |

For Codex, CPAMP prefers a nonempty `effective_service_tier` for display,
aggregation, and estimated cost. In CPAMP's persisted events and exports,
`service_tier` is the resolved canonical value, and `request_service_tier`
preserves client intent.

When CPA filters `service_tier` out of a valid final Codex request, it must emit
`effective_service_tier: "auto"`. It must not omit the metadata field: omission
is indistinguishable from older CPA versions that never reported a final tier.
For example, the following raw event is accounted as `auto`, while the original
`priority` request remains available in request details:

```json
{
  "provider": "codex",
  "service_tier": "priority",
  "effective_service_tier": "auto",
  "response_service_tier": "default"
}
```

`auto` means the final request omitted the tier or explicitly requested automatic
selection. It does not claim that the upstream used an explicit `default`
request, and CPAMP's estimated cost is not an upstream invoice.

Compatibility rules:

- An explicit final `priority` still selects Fast pricing even if the upstream
  reports `default`.
- Missing final metadata retains the legacy provider-aware fallback. Do not
  assume that all missing values mean `auto` or rewrite historical events.
- Explicit blank final metadata retains the existing legacy `default`
  normalization; new producers should emit `auto` instead.
- Non-Codex providers retain their existing response-tier precedence.
- CPAMP exports preserve the canonical value on reimport; they are not parsed
  as raw CPA client-request metadata.

The producer correction belongs in CLIProxyAPI. CPAMP already accepts explicit
`auto`; regression coverage verifies ingestion, persistence, compatible payloads,
export/reimport, event rows, and estimated pricing. Deploying only CPAMP cannot
reconstruct final metadata omitted by an older CPA producer. No database schema
migration or historical backfill is needed for new corrected events.

Producer fix: [report auto for omitted Codex service tiers](https://github.com/nekopara-ai/CLIProxyAPI/commit/a1d0d2d9c8e2e2da6701d9eac9fcb8e3a0fc8c35).
