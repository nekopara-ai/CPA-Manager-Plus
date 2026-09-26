# Credential timezone and fingerprint policies

This UI requires a matching CPA build with `credential-policies` / `fingerprint`
support. The retired ticket/gateway-mint feature and its management UI are removed.

In Accounts → credential details → Configuration:

- Timezone, country, region/state and city each have an inheritance / custom / off
  selector and a separate custom-value input. Timezone uses IANA names.
  A custom timezone clears the **global** geography defaults to avoid contradictory
  locations; explicitly scoped geography overrides still apply. Turning timezone
  rewriting off also turns location rewriting off. Turning an individual location
  field off preserves the client's value; it does not delete it. Geography only
  replaces fields already supplied by the client and does not change proxy egress.
- All 13 per-credential fingerprint parameters have visual controls:
  - `enabled` and `retain-answers`: inherit / on / off.
  - `models`: inherit, or a custom list (one requested name per line or comma).
  - `expected-models`: inherit, or `requested-name = bank-label` lines. An empty
    **custom** mapping explicitly clears inherited aliases, unlike inheritance.
  - `interval-seconds`, `cooldown-seconds`, `confidence`, `minimum-answers`,
    `question-retries`, `retry-seconds`, `max-retry-seconds`, `daily-request-limit`,
    and `history-limit`: blank inherits; nonempty values are range/type checked.
    Hints show the last effective values reported by CPA, not a live preview of
    unsaved edits. Explicit zero retries and false switches are preserved.
- The optional advanced fingerprint JSON editor and visual form share one draft.
  Visual edits preserve unknown future keys; malformed JSON remains available for
  repair and blocks saving. Reset restores inheritance for the entire fingerprint
  override; the regular configuration Save action persists all edits.

The existing per-credential proxy, headers, scheduling and provider-specific
controls remain available; none of these choices updates a different credential.
Multi-member single-object plugin sources remain read-only because their children
share one configuration. JSON-array members are updated by verified identity, not
by blindly replacing every member.

Global defaults and filename-scoped overrides are editable in Config's YAML view:

```yaml
fingerprint:
  enabled: false  # Turn on explicitly; diagnostics consume quota.
  models: [gpt-6-sol, gpt-6-astra]
  interval-seconds: 3600
  cooldown-seconds: 1800
  confidence: 0.95
  minimum-answers: 3
  daily-request-limit: 300
credential-policies:
  account.json:
    timezone-override: Asia/Tokyo
    timezone-override-country: JP
    timezone-override-region: Tokyo
    timezone-override-city: Shinjuku
    fingerprint:
      interval-seconds: 7200
```

Credential-file settings take precedence over named YAML policies and global defaults.
The global `fingerprint.enabled` master switch must also be on. Other fields are
inherited when omitted; explicit false is preserved. Shared-source read-only
restrictions still apply. Both Full and Panel modes use the same CPA management API.
The master switch, worker count, startup delay/jitter, bank file and state file
paths are instance settings: edit them in Config → YAML, not in a credential form.
The UI does not enable the master switch or run diagnostics merely by opening or
saving a form. Credential JSON uses `timezone_override[_country|_region|_city]`;
YAML uses the hyphenated names above. Removing an override (`null` in the PATCH API)
restores inheritance; the empty string is an explicit no-rewrite override.

Overview and account badges display CPA's actual `fingerprint_status`: requested
and predicted models, bank-relative scores (not guaranteed identity), valid output
counts, errors, next run, cooldown, triggering model, daily budget and history.
No valid outputs is shown as unavailable, not 0% confidence. Missing backend
support is not displayed as successful monitoring.

One confident mismatch blocks only that credential's corresponding upstream model.
Healthy siblings, unmonitored models and other credentials remain unaffected.
Each model has its own cooldown and next-test time; after cooldown, that model's
successful fresh test restores it without waiting for other models. Account-wide
`disabled` and `unavailable` flags are not set by a fingerprint model mismatch.
The panel lists per-model gates and cooldowns, and shows live test progress. Each
new result displays its actual decision threshold separately from today's config.
Old/unknown-policy results are labelled historical, never silently reinterpreted.
Non-Codex providers are explicitly skipped and consume no fingerprint budget.
The manual disabled bit remains separate and is never automatically cleared.
Automatic monitoring is off on upgrade, and no production restart is performed by
editing the UI code. See CPA's `docs/credential-fingerprint.md` for complete runtime,
storage, replica, budget and statistical limitations.
