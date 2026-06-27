# AGENTS.md

This repository is the npm package `@xshuliner/build-info`. Treat it as frontend build infrastructure: changes should keep the package small, stable, ESM-only, and safe to publish publicly.

## Project Shape

- Runtime target: Node.js >= 20.
- Package format: ESM only.
- Package manager: pnpm.
- Build tool: tsup.
- Test runner: Vitest.
- Lint/format: ESLint flat config and Prettier.
- Public browser global: `window.__xshuliner__`.
- Default generated static directory: `public/__xshuliner__`.

Important entry points:

- `src/index.ts`: public shared exports that must stay browser-safe.
- `src/node.ts`: Node API and Node-only exports.
- `src/cli.ts`: executable CLI for `xshuliner-build-info` and `xbi`.
- `src/react.tsx`: React client component entry.
- `src/next.tsx`: Next.js helper entry. Keep Next.js as an optional peer dependency.
- `src/core/*`: collection and rendering internals.
- `src/utils/*`: small reusable utilities.

## Design Boundaries

- Do not add compatibility for old globals such as `window.__orz2__`.
- Do not read Git, CI, machine, or secret-like data in the browser. All collection happens at build time.
- Do not let the root entry import Node-only modules such as `node:fs`, `node:os`, or `node:child_process`.
- Do not make `react` or `next` hard runtime dependencies of the Node/CLI entry.
- Keep `next` optional. The local `src/next-script.d.ts` declaration allows type/build checks without installing Next.js.
- Keep `build-info.js` safe for direct browser loading. JSON must be serialized safely and must not emit raw `</script>`.
- Keep `print` non-enumerable and the mounted object frozen.
- Keep remote URL sanitization strict. Never output token, password, username credential, or query/hash credential material.
- Public runtime fields must stay intentionally whitelisted. Do not dump arbitrary environment variables into generated files.

## Build Output Notes

`pnpm build` runs:

```bash
tsup && node scripts/ensure-use-client.mjs
```

The post-build script prepends `'use client';` to `dist/react.js`. Keep this unless the bundler reliably preserves the directive itself; Next App Router consumers need the React entry to remain a client component.

Generated outputs are intentionally ignored:

- `dist/`
- `public/__xshuliner__/`
- `node_modules/`

## Validation

Before handing off meaningful changes, run:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

For CLI changes, also run:

```bash
node dist/cli.js generate
node -e "JSON.parse(require('node:fs').readFileSync('public/__xshuliner__/build-info.json', 'utf8'))"
node --input-type=module -e "await import('./public/__xshuliner__/build-info.js'); const info = globalThis.__xshuliner__; console.log(Boolean(info), typeof info.print, Object.keys(info).includes('print'), Object.isFrozen(info));"
```

For bin/package changes, verify the packed package:

```bash
pnpm pack
tmp_dir="$(mktemp -d)"
npm exec --yes --package "$PWD/xshuliner-build-info-0.1.0.tgz" --prefix "$tmp_dir" -- xbi generate --env bin-test --mode installed-bin
rm -f xshuliner-build-info-*.tgz
```

For GitHub Actions changes, run:

```bash
git diff --check
actionlint .github/workflows/*.yml
```

If `actionlint` is unavailable, manually check YAML expressions, heredoc indentation, and reusable workflow inputs/secrets.

## Tests To Keep Meaningful

The baseline tests cover:

- `sanitizeRemoteUrl`: credential stripping and SSH-to-HTTPS normalization.
- `renderBuildInfoScript`: global name, freeze, non-enumerable `print`, and `</script>` escaping.
- `collectBuildInfo`: non-Git/non-package tolerance and env override priority.
- `collectGitInfo`: non-Git tolerance.

When changing collection priorities or output shape, add focused tests rather than broad snapshots. Output contains timestamps and machine-specific values, so avoid brittle full-object snapshots.

## GitHub Actions

This repository contains two kinds of workflows:

- Package workflows for this repo:
  - `.github/workflows/ci.yml`
  - `.github/workflows/release-package.yml`
- Migrated reusable workflows from `xshuliner/workflows`:
  - `.github/workflows/release-version.yml`
  - `.github/workflows/release-tag.yml`
  - `.github/workflows/release-deploy.yml`

When modifying reusable workflow inputs, outputs, secrets, or behavior, update both:

- `.github/README.md`
- `README.md` if users need to know about the change

Do not print secret values in workflow logs. Use public names such as `SSH_HOST`, `SSH_USERNAME`, `SSH_KEY`, `SERVER_PATH`, `NOTIFY_WEBHOOKS`, and `REPORT_AUTHORIZATION` consistently with the migrated workflow conventions.

### Reusable Deploy Workflow Conventions

`release-deploy.yml` is the shared CI/CD contract for business repositories. Keep the common workflow responsible for version resolution, temporary package version sync, dependency install, build execution, artifact packaging, generic deploy transports, deploy reporting, webhook notification, and run summaries. Keep business-specific knowledge in each caller: build commands, server paths, PM2 commands, brand/appid mapping, R2 bucket names, and public URLs.

Supported `target` values:

- `web` and `api`: server deploys over SSH/rsync.
- `server`: generic server deploy over SSH/rsync.
- `weapp`: WeChat Mini Program upload.
- `r2`: Cloudflare R2 upload.

Business project `workflow_dispatch` inputs must use the same names, descriptions, defaults, and option order unless there is a strong reason to document an exception:

```yaml
env:
  description: Deployment environment (prod, uat).
  required: true
  default: prod
  type: choice
  options:
    - prod
    - uat
bump:
  description: Version bump before deploy (major, feat, fix, none).
  required: false
  default: feat
  type: choice
  options:
    - major
    - feat
    - fix
    - none
```

`bump: major` increments the major version, `bump: feat` increments the minor version, and `bump: fix` increments the patch version. Reusable workflows should keep accepting legacy `minor` and `patch` values as aliases for compatibility, but business `workflow_dispatch` forms should show only `major`, `feat`, `fix`, and `none`.

`bump: none` reuses the latest matching tag and does not create a new tag. The build job still receives the resolved version and, when `sync_package_json_version_before_build` is true, gets a temporary `package.json` version update without committing it.

The shared build step injects these environment variables for callers:

- `RELEASE_VERSION` and `RELEASE_VERSION_NUMBER`
- `XSHULINER_TAG_VERSION`, `XSHULINER_RELEASE_VERSION`, and `XSHULINER_APP_VERSION`
- `XSHULINER_APP_ENV`, `XSHULINER_APP_MODE`, `XSHULINER_DEPLOY_TARGET`, `XSHULINER_DEPLOY_REGION`, and `XSHULINER_DEPLOY_URL`
- `XSHULINER_RELEASE_ID` and `XSHULINER_BUILD_ID`

Do not duplicate these exports in business workflows unless the project intentionally overrides them.

Business `.github/README.md` files should stay short: document the manual entry point, the shared `env`/`bump` inputs, required secrets, and only the project-specific deploy paths, PM2 names, brand mapping, or R2 URL shape.

## Release Notes

The package version currently lives in `package.json`. `release-package.yml` can create semantic Git tags through the migrated `release-tag.yml`. Publishing to npm requires `NPM_TOKEN` and `publish_to_npm: true`.

If changing the tarball contents, confirm `package.json.files` still includes only what users need:

- `dist`
- `README.md`
- `LICENSE`

## Security Notes

This package publishes build metadata to static public files. Keep README warnings clear:

- Do not pass secrets, tokens, or private env vars to CLI options.
- Commit messages can contain sensitive information.
- `build-info.js` and `build-info.json` should use `no-store` caching.
- The package does not collect online user data.

When in doubt, prefer omitting a field over exposing potentially sensitive data.
