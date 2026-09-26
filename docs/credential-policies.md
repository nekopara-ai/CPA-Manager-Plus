# Credential timezone and fingerprint policies

This UI requires a matching CPA build with `credential-policies` / `fingerprint`
support. The retired ticket/gateway-mint feature and its management UI are removed.

In Accounts → credential details → Configuration:

- Timezone: inherit config, use a custom IANA zone, or explicitly disable rewriting.
- Fingerprint JSON: edit any per-credential override. Blank restores inheritance.
  Common keys: `enabled`, `models`, `interval-seconds`, `cooldown-seconds`,
  `confidence`, `minimum-answers`, `question-retries`, `retry-seconds`,
  `max-retry-seconds`, `daily-request-limit`, `history-limit`, `retain-answers`,
  and `expected-models` (requested name → bank label).

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
    fingerprint:
      interval-seconds: 7200
```

Credential-file settings take precedence over named YAML policies and global defaults.
The global `fingerprint.enabled` master switch must also be on. Other fields are
inherited when omitted; explicit false is preserved. Shared-source read-only
restrictions still apply. Both Full and Panel modes use the same CPA management API.

Overview and account badges display CPA's actual `fingerprint_status`: requested
and predicted models, bank-relative scores (not guaranteed identity), valid output
counts, errors, next run, cooldown, triggering model, daily budget and history.
No valid outputs is shown as unavailable, not 0% confidence. Missing backend
support is not displayed as successful monitoring.

One confident mismatch blocks the entire credential for business requests. Cooldown
expiry permits diagnostics only; all configured models must pass before recovery.
The manual disabled bit remains separate and is never automatically cleared.
Automatic monitoring is off on upgrade, and no production restart is performed by
editing the UI code. See CPA's `docs/credential-fingerprint.md` for complete runtime,
storage, replica, budget and statistical limitations.
