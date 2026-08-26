# Nekopara fork maintenance

This fork keeps CPA Manager Plus current with `seakee/CPA-Manager-Plus` while
carrying the minimum compatibility changes required by the Nekopara CPA fork.

## Branches

- `main` contains the fork automation and receives upstream `main` through an
  ordinary Git merge. The workflow pushes only after a conflict-free merge.
- `codex/cpamp-effective-tier` contains the compatibility patch. The sync
  workflow merges updated `main` into this branch without conflict overrides.
- A merge conflict fails closed and requires a reviewed manual resolution.

After a successful merge, the sync workflow explicitly dispatches the patched
image workflow for the exact new commit. This is required because a branch push
made with the repository `GITHUB_TOKEN` does not start another workflow run.

GitHub scheduled workflows only run from the default branch. Keep
`.github/workflows/sync-upstream-main.yml` on the default `main` branch even
when the application patch is maintained separately.

The sync workflow disables the known inherited publishing workflows before
performing any update, then disables every registered workflow except the sync
and patched-image workflows. This allowlist prevents newly inherited upstream
automation from becoming part of the fork release path. Any future fork-owned
workflow must be reviewed and added to the allowlist explicitly. During initial
fork setup, the known publishing workflows can also be disabled manually before
Actions is enabled:

```bash
gh workflow disable release.yml --repo nekopara-ai/CPA-Manager-Plus
gh workflow disable release-publish-recovery.yml --repo nekopara-ai/CPA-Manager-Plus
gh workflow disable release-telegram-recovery.yml --repo nekopara-ai/CPA-Manager-Plus
```

Do not create `v*` tags in the fork. The patched image workflow publishes OCI
tags only and never creates Git tags or GitHub Releases.

## Service-tier compatibility

The Nekopara CPA fork can publish three values:

- `service_tier`: the original client request;
- `effective_service_tier`: the final translated outbound request after CPA
  configuration overrides;
- `response_service_tier`: the tier reported by the upstream response.

For Codex, `effective_service_tier` is the canonical billing and aggregation
value. Older CPA payloads do not contain it and retain CPAMP's existing
provider-aware fallback. The canonical value remains stored in the existing
`usage_events.service_tier` column, so the patch does not require a SQLite
schema migration.

## Images

Every push to the patched branch must pass type checking, lint, frontend and
repository tests, a single-file panel build, the full Manager Server test suite,
and the Go race detector before publishing:

```text
ghcr.io/nekopara-ai/cpa-manager-plus:<upstream>-nekopara.<revision>
ghcr.io/nekopara-ai/cpa-manager-plus:sha-<commit>
ghcr.io/nekopara-ai/cpa-manager-plus:patched
```

Images are built for `linux/amd64` and `linux/arm64` with BuildKit provenance
and an SBOM. The Docker base images are pinned by manifest digest.

The workflows do not deploy or restart production. Production upgrades remain
manual and should pin the tested image digest, snapshot both SQLite state and
`data.key`, preserve the existing container configuration, and verify health
and real CPA collection before removing the rollback target.
