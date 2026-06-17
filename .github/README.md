# GitHub Actions

本仓库有两类 workflow：

- `CI`：push、pull request 或手动触发，执行安装、lint、test、build、生成 build info、npm pack。
- `Release Package`：手动触发，先跑质量检查，再调用本仓库迁移来的 `release-tag.yml` 计算和创建 tag，可选发布 npm。

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

## 部署入口

本仓库默认不做服务器部署。npm 包发布入口是 `Release Package`：

1. 打开 `Actions` -> `Release Package`。
2. 选择 `bump`：`patch`、`minor`、`major` 或 `none`。
3. 需要演练时勾选 `dry_run`。
4. 需要发布 npm 时勾选 `publish_to_npm`，并确保已配置 `NPM_TOKEN`。

## 构建信息产物

CI 会生成并上传 artifact：

```text
public/__xshuliner__/build-info.json
public/__xshuliner__/build-info.js
```

这些文件用于验证本包自己的采集链路：GitHub Actions 环境变量、Git 信息、包版本、release/build id 都会进入构建期 public 信息。
