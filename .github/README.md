# GitHub Actions

本仓库有两类 workflow：

- `CI`：push、pull request 或手动触发，执行安装、lint、test、build、生成 build info、npm pack。
- `Release Package`：手动触发，先跑质量检查，再调用本仓库迁移来的 `release-tag.yml` 计算版本、同步 `package.json`、创建 tag，可选发布 npm。

公共 reusable workflows 已同步迁移：

- `.github/workflows/release-version.yml`
- `.github/workflows/release-tag.yml`
- `.github/workflows/release-deploy.yml`

服务器部署辅助脚本在 `scripts/configure-deploy-permissions.sh`。

## 配置位置

`Settings` -> `Secrets and variables` -> `Actions`。

## Variables

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| 无 | 否 | 当前 npm 包 CI 不需要 GitHub Actions Variables。 |

## Secrets

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `NPM_TOKEN` | 否 | 仅在 `Release Package` 勾选 `publish_to_npm` 时需要，用于发布 `@xshuliner/build-info`。 |

如果未来直接使用 `release-deploy.yml` 做服务器部署，还需要按目标配置 `SSH_HOST`、`SSH_USERNAME`、`SSH_KEY`、`SERVER_PATH` 或 `server_path`/`server_path_map`。
如果使用 `target: r2` 上传到 Cloudflare R2，需要配置 `CLOUDFLARE_R2_ACCOUNT_ID`、`CLOUDFLARE_R2_ACCESS_KEY_ID` 和 `CLOUDFLARE_R2_SECRET_ACCESS_KEY`。
API 项目需要 `pnpm`/PM2 时，可用 `INSTALL_PM2=true sudo -E bash scripts/configure-deploy-permissions.sh` 同时准备部署用户可用的 `pnpm` 和 PM2。

## 部署入口

本仓库默认不做服务器部署。npm 包发布入口是 `Release Package`：

1. 打开 `Actions` -> `Release Package`。
2. 选择 `bump`：`patch`、`minor`、`major` 或 `none`。
3. 需要演练时勾选 `dry_run`。
4. 需要发布 npm 时勾选 `publish_to_npm`，并确保已配置 `NPM_TOKEN`。

`Release Package` 会根据已有 tag 计算下一版，并在创建 tag 前把根目录 `package.json` 的 `version` 同步为该版本号、提交到当前分支。`dry_run` 只计算和构建，不会提交、打 tag 或发布。

单独运行 `Release Tag` 时，如果需要同样同步 `package.json`，勾选 `sync_package_json_version`；这个选项要求 workflow 运行在分支 ref 上。

## 业务项目接入约定

公共 `release-deploy.yml` 只放通用能力：版本解析、临时同步 `package.json` 版本、依赖安装、业务构建、产物打包、SSH/小程序/R2 部署、通知、上报和摘要。业务项目只保留自己的构建命令、服务器路径、PM2 命令、品牌密钥映射、R2 bucket 和公开 URL。

支持的 `target`：

| target | 用途 |
| --- | --- |
| `web` / `api` / `server` | SSH + rsync 部署到服务器。 |
| `weapp` | 上传微信小程序体验版。 |
| `r2` | 上传构建产物到 Cloudflare R2。 |

`release-deploy.yml` 会先解析版本，再执行业务构建，构建成功后创建 tag 并部署。因为 build info 通常在业务构建命令里生成，而 tag 此时还没有推送，workflow 会先在 build job 创建一个不推送的本地 release tag，并在 `build_command` 环境中默认注入：

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `RELEASE_VERSION` | `v1.2.3` | 通用 release tag。 |
| `RELEASE_VERSION_NUMBER` | `1.2.3` | 无前缀版本号。 |
| `XSHULINER_TAG_VERSION` | `v1.2.3` | `build-info` 的 `tagVersion` 和 `git.nearestTag`。 |
| `XSHULINER_RELEASE_VERSION` | `v1.2.3` | `XSHULINER_TAG_VERSION` 的兼容别名。 |
| `XSHULINER_APP_VERSION` | `1.2.3` | `build-info` 的 `app.version`。 |
| `XSHULINER_RELEASE_ID` | `${{ github.run_id }}-${{ github.sha }}` | 部署追踪 id。 |
| `XSHULINER_BUILD_ID` | `${{ github.run_number }}` | 构建序号。 |

接入业务项目时保持这些约定：

- `workflow_dispatch.inputs.env` 统一使用描述 `Deployment environment.`，默认 `prod`，顺序 `prod`、`uat`。
- `workflow_dispatch.inputs.bump` 统一使用描述 `Version bump before deploy.`，默认 `patch`，顺序 `patch`、`minor`、`major`、`none`。
- 需要 Git 信息的 checkout 使用 `fetch-depth: 0`。
- 前端构建前执行 `xbi generate`，不要在业务项目里再次计算版本。
- `XSHULINER_RELEASE_ID` 只做追踪 id，不要拿它替代 tag 版本。
- 不要在业务 workflow 里重复 export 公共 workflow 已注入的 `XSHULINER_*` 变量，除非项目确实要覆盖默认值。

`bump: none` 表示复用最新 tag，不创建新 tag。公共 workflow 仍会把解析出的版本注入构建环境，并在默认配置下临时同步 `package.json.version`，但不会提交。

## 构建信息产物

CI 会生成并上传 artifact：

```text
public/__xshuliner__/build-info.json
public/__xshuliner__/build-info.js
```

这些文件用于验证本包自己的采集链路：GitHub Actions 环境变量、Git 信息、包版本、release/build id 都会进入构建期 public 信息。
