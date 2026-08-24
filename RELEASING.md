# Release Guide

This document records the Zeeho Git Graph repository and registry release procedure. Creating tags
or publishing to an extension registry still requires explicit release approval.

## Current release identity

- Repository target: `gerhardtEyes/zeeho-git-graph`
- Package name: `zeeho-git-graph`
- Display name: `Zeeho Git Graph`
- Target version: `0.6.2`
- Copyright holder for new modifications: `tamzeeho`
- VS Marketplace Publisher ID: `Tamzeeho`
- VS Marketplace Publisher display name: `TanZiHao`
- Final extension ID: `Tamzeeho.zeeho-git-graph`

The VS Marketplace Publisher has been created. `package.json#publisher` and the extension-host test
must continue to match the immutable Publisher ID `Tamzeeho`; the display name `TanZiHao` is not the
value used for the extension identifier.

## Repository preparation

1. Keep the full Git history and upstream attribution.
2. For the initial setup, create an empty repository named `zeeho-git-graph` under `gerhardtEyes`;
   do not initialize it with a README, license, or `.gitignore`.
3. Preserve the original project remote as `upstream`, then add the Zeeho repository as `origin`:

   ```sh
   git remote rename origin upstream
   git remote add origin git@github.com:gerhardtEyes/zeeho-git-graph.git
   git push -u origin main
   ```

4. Do not push historical tags while a tag-triggered publishing workflow is enabled. The first
   Zeeho Git Graph release tag should be created only after repository settings and secrets are
   ready.

## Registry preparation

### VS Code Marketplace

1. Confirm access to the existing `Tamzeeho` Marketplace Publisher.
2. Set the GitHub Actions repository variable `VS_MARKETPLACE_PUBLISHER` to `Tamzeeho`.
3. Add the `VS_MARKETPLACE_TOKEN` repository secret required by the release workflow.
4. Confirm the final extension ID is `Tamzeeho.zeeho-git-graph`.

### Open VSX

1. Sign the Open VSX Publisher Agreement.
2. Create or claim the namespace matching `package.json#publisher`.
3. Add an `OPEN_VSX_TOKEN` repository secret.

## Release checks

Run all checks from a clean worktree:

```sh
pnpm install --frozen-lockfile
pnpm run format
pnpm run lint
pnpm run typecheck
pnpm run l10n:check
pnpm run test
pnpm run test:ext
PUBLIC_RELEASE=true EXPECTED_PUBLISHER=Tamzeeho EXPECTED_VERSION=0.6.2 pnpm run release:check
pnpm run package
pnpm dlx @vscode/vsce package --no-dependencies --out zeeho-git-graph-0.6.2.vsix
unzip -t zeeho-git-graph-0.6.2.vsix
shasum -a 256 zeeho-git-graph-0.6.2.vsix
```

Also verify that the VSIX contains `LICENSE`, `THIRD_PARTY_NOTICES.md`, and generated legal-notice
files, and does not contain credentials or private development files.

## Release procedure

1. Replace the `Unreleased` heading in `CHANGELOG.md` with the final version and date.
2. Confirm `package.json#version` matches the release tag.
3. Commit the release metadata.
4. Create the tag only after CI is green:

   ```sh
   git tag -s v0.6.2 -m "Zeeho Git Graph v0.6.2"
   git push origin v0.6.2
   ```

5. Verify the GitHub Release, VS Marketplace, and Open VSX listings all use the same VSIX and
   version.
