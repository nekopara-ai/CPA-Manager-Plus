import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readWorkflow = (name) =>
  readFileSync(path.join(repoRoot, '.github', 'workflows', name), 'utf8');

describe('Nekopara fork workflows', () => {
  it('syncs upstream through main and fails closed on patch conflicts', () => {
    const workflow = readWorkflow('sync-upstream-main.yml');

    expect(workflow).toContain("github.repository == 'nekopara-ai/CPA-Manager-Plus'");
    expect(workflow).toContain('UPSTREAM_REPOSITORY: seakee/CPA-Manager-Plus');
    expect(workflow).toContain("'+refs/heads/main:refs/remotes/upstream/main'");
    expect(workflow).toContain('git merge --no-edit refs/remotes/upstream/main');
    expect(workflow).toContain("'+refs/heads/main:refs/remotes/origin/main'");
    expect(workflow).toContain('git merge-base --is-ancestor refs/remotes/origin/main HEAD');
    expect(workflow).toContain('git push origin HEAD:refs/heads/main');
    expect(workflow).toContain('PATCH_BRANCH: codex/cpamp-effective-tier');
    expect(workflow).toContain('git merge --no-edit origin/main');
    expect(workflow).toContain('git merge --abort');
    expect(workflow).toContain('actions: write');
    expect(workflow).toContain('release.yml');
    expect(workflow).toContain('release-publish-recovery.yml');
    expect(workflow).toContain('release-telegram-recovery.yml');
    expect(workflow).toContain('/actions/workflows/${workflow}/disable');
    expect(workflow).toContain('Disable all workflows not used by the fork');
    expect(workflow).toContain('.github/workflows/sync-upstream-main.yml');
    expect(workflow).toContain('.github/workflows/patched-image.yml');
    expect(workflow).toContain('/actions/workflows/${workflow_id}/disable');
    expect(workflow).toContain('gh workflow run patched-image.yml');
    expect(workflow).toContain('-f source_sha="${source_sha}"');
    expect(workflow).toContain('.status != "completed"');
    expect(workflow).toContain('.conclusion == "success"');
    expect(workflow).toContain('failed runs');
    expect(workflow).not.toContain('git push --force');
    expect(workflow).not.toContain('/merge-upstream');
    expect(workflow).not.toContain('-X theirs');
    expect(workflow).not.toContain('-X ours');
  });

  it('publishes only the tested patched source to the fork GHCR namespace', () => {
    const workflow = readWorkflow('patched-image.yml');

    expect(workflow).toContain('IMAGE_NAME: ghcr.io/nekopara-ai/cpa-manager-plus');
    expect(workflow).toContain('source=${source_sha} patch_head=${patch_head}');
    expect(workflow).toContain('Verify effective service tier patch is present');
    expect(workflow).toContain('TestNormalizeRawPrefersReportedEffectiveServiceTier');
    expect(workflow).toContain('go test ./...');
    expect(workflow).toContain('go test -race -timeout 30m ./...');
    expect(workflow.indexOf('  image:')).toBeGreaterThan(workflow.indexOf('  test:'));
    expect(workflow).toContain('needs: test');
    expect(workflow).toContain('platforms: linux/amd64,linux/arm64');
    expect(workflow).toContain('provenance: mode=max');
    expect(workflow).toContain('sbom: true');
    expect(workflow).not.toContain('docker.io/');
    expect(workflow).not.toContain('DOCKERHUB_');
    expect(workflow).not.toContain('git tag');
    expect(workflow).not.toContain('gh release');
  });
});
