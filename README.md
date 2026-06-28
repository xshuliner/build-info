# @xshuliner/build-info

构建期生成前端项目的构建信息、部署信息、Git 信息和 CI 信息，并输出到静态目录。页面运行时可以通过 `window.__xshuliner__` 查看，也可以用 React/Next.js 组件展示。

这个包只在构建期采集信息，不会收集线上用户数据，也不会在浏览器里执行 Git 命令。

## 快速接入

安装：

```bash
pnpm add -D @xshuliner/build-info
```

在业务项目构建前生成信息：

```json
{
  "scripts": {
    "build": "xbi generate --env production && vite build"
  }
}
```

默认生成：

```text
public/__xshuliner__/build-info.json
public/__xshuliner__/build-info.js
```

页面中加载：

```html
<script src="/__xshuliner__/build-info.js"></script>
```

浏览器控制台：

```js
window.__xshuliner__
window.__xshuliner__.print()
```

## React 使用

```tsx
import { BuildInfoPanel } from '@xshuliner/build-info/react'

export function Footer() {
  return <BuildInfoPanel />
}
```

组件会优先读取 `window.__xshuliner__`；如果没有加载 `build-info.js`，会请求 `/__xshuliner__/build-info.json`。

## Next.js 使用

App Router：

```tsx
import { BuildInfoScript } from '@xshuliner/build-info/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <BuildInfoScript />
        {children}
      </body>
    </html>
  )
}
```

再在任意客户端组件里使用：

```tsx
import { BuildInfoPanel } from '@xshuliner/build-info/react'

export function BuildFooter() {
  return <BuildInfoPanel compact />
}
```

`next` 是 optional peer dependency，只有导入 `@xshuliner/build-info/next` 时才需要业务项目安装 Next.js。

## CLI

```bash
xbi generate
xshuliner-build-info generate
```

常用参数：

```bash
xbi generate \
  --out public/__xshuliner__ \
  --global-name __xshuliner__ \
  --tag-version v1.0.0 \
  --app-name my-app \
  --app-version 1.0.0 \
  --env production \
  --mode client \
  --deploy-target production \
  --deploy-url https://example.com \
  --release-id prod-xxx \
  --build-id build-xxx
```

默认值：

| 项 | 默认值 |
| --- | --- |
| 全局变量 | `window.__xshuliner__` |
| 输出目录 | `public/__xshuliner__` |
| 页面访问路径 | `/__xshuliner__/` |

## Node API

```ts
import { generateBuildInfo } from '@xshuliner/build-info/node'

await generateBuildInfo({
  outDir: 'public/__xshuliner__',
  globalName: '__xshuliner__',
  tagVersion: 'v1.0.0',
  appName: 'my-app',
  env: 'production'
})
```

## GitHub Actions 接入业务项目

普通 CI 只需要在前端构建前生成 build info：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          package-manager-cache: false
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec xbi generate --env production --mode github-actions
      - run: pnpm build
```

这样生成的 `build-info.json` 会包含 GitHub Actions run、commit、branch 等构建期信息。

正式发布或部署推荐复用本仓库的公共 workflow：

```yaml
name: Deploy

run-name: Deploy ${{ inputs.env }} by @${{ github.actor }}

on:
  workflow_dispatch:
    inputs:
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

permissions:
  contents: write

jobs:
  deploy:
    uses: xshuliner/build-info/.github/workflows/release-deploy.yml@master
    with:
      target: web
      env: ${{ inputs.env }}
      project_name: my-project
      bump: ${{ inputs.bump }}
      node_version: "22"
      build_command: pnpm build:${{ inputs.env }}
      build_path: dist
      server_path_map: |
        {
          "prod": "/var/www/example/html",
          "uat": "/var/www/example/html/uat"
        }
      server_health_check_url_map: |
        {
          "prod": "http://127.0.0.1:3000/health",
          "uat": "http://127.0.0.1:3001/health"
        }
      server_health_check_expected_texts: |
        ["ok"]
    secrets:
      SSH_HOST: ${{ secrets.SSH_HOST }}
      SSH_USERNAME: ${{ secrets.SSH_USERNAME }}
      SSH_KEY: ${{ secrets.SSH_KEY }}
```

`release-deploy.yml` 支持 `target: web`、`api`、`server`、`weapp` 和 `r2`。公共 workflow 会先解析版本，再执行业务构建，构建成功后创建 tag 并部署。因为 tag 在 build job 之后才推送，workflow 会先创建一个不推送的本地 release tag，并把版本信息注入给 `build_command`。

### Workflow 接入最佳实践

- 公共边界：公共 workflow 负责版本、安装、构建、产物打包、SSH/小程序/R2 部署、服务器健康检查、通知、上报和摘要；业务 workflow 只保留构建命令、路径、PM2 命令、品牌密钥映射、R2 bucket、公开 URL 和健康检查 URL。
- 单一版本来源：release workflow 只输出 `version`（如 `v1.2.3`）和 `version_number`（如 `1.2.3`），业务项目不要再次自行计算。
- 默认注入：`build_command` 会收到 `RELEASE_VERSION`、`RELEASE_VERSION_NUMBER`、`XSHULINER_TAG_VERSION`、`XSHULINER_RELEASE_VERSION`、`XSHULINER_APP_VERSION`、`XSHULINER_RELEASE_ID`、`XSHULINER_BUILD_ID` 等变量。
- checkout：需要 Git 信息的 job 使用 `actions/checkout` 并设置 `fetch-depth: 0`。
- 生成顺序：在前端构建命令之前运行 `xbi generate`，确保产物里的 `build-info.js` 和 `build-info.json` 跟随同一次构建。
- 健康检查：服务器部署后需要 HTTP 验证时，使用 `server_health_check_url` 或 `server_health_check_url_map` 声明从远端服务器访问的 URL；用 `server_health_check_expected_texts` 声明响应里必须出现的 marker。
- 手动入口：`env` 统一描述为 `Deployment environment (prod, uat).`，默认 `prod`，顺序 `prod`、`uat`；`bump` 统一描述为 `Version bump before deploy (major, feat, fix, none).`，默认 `feat`，顺序 `major`、`feat`、`fix`、`none`。
- 版本语义：`major` 增加大版本号，`feat` 增加中版本号，`fix` 增加小版本号；公共 workflow 为兼容旧调用仍接受 `minor`/`patch`，但业务项目手动入口只展示 `major`、`feat`、`fix`、`none`。
- `bump: none`：复用最新 tag，不创建新 tag；公共 workflow 仍会注入解析出的版本，并临时同步 `package.json.version` 用于本次构建。
- 占位版本：如果项目版本完全由 workflow 赋值，`package.json.version` 可以保留占位值，但 build job 必须注入 `XSHULINER_APP_VERSION` 或临时同步 `package.json.version`。

## 发布这个包到 npm

发布前确认你有 `@xshuliner` 这个 npm scope 的发布权限。因为这是 scoped package，首次公开发布必须显式使用 public access。

首次发布建议在本地完成：

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
npm pack --dry-run
npm login
npm publish --access public
```

本地直接发布需要 npm 账号满足发布认证要求，例如开启 2FA，或使用允许发布的 granular access token。本地发布前要先修改 `package.json` 里的 `version`，npm 不允许重复发布同一个版本号。

包第一次发布成功后，推荐改用 GitHub Actions + Trusted Publishing：

1. 在 npm 包页面配置 Trusted Publishing，指向这个仓库和 `.github/workflows/release-package.yml`。
2. 打开 GitHub `Actions` -> `Release Package`。
3. 选择版本类型和是否 `publish_to_npm`。
4. 运行 workflow；它会执行安装、lint、test、build、生成 build info、打包，根据已有 tag 计算下一版，把 `package.json` 的 `version` 同步为该版本号，提交后创建 tag，并在发布时执行 `npm publish --access public`。

如果不用 Trusted Publishing，也可以在 GitHub Actions Secrets 配置 `NPM_TOKEN`，再用同一个 `Release Package` workflow 发布。

发布成功后，其他项目就可以安装：

```bash
pnpm add -D @xshuliner/build-info
```

## 缓存建议

`build-info.js` 和 `build-info.json` 应该禁用缓存，避免页面看到旧部署信息。

Cloudflare Pages `_headers`：

```text
/__xshuliner__/*
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
```

Nginx：

```nginx
location /__xshuliner__/ {
  add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
  try_files $uri =404;
}
```

Next.js：

```js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/__xshuliner__/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

## 安全说明

- 不要把 secret、token、私有环境变量通过 CLI 参数或公开环境变量写进 build info。
- Git remote 会脱敏，但 commit message 可能包含敏感信息，公开站点要注意提交内容。
- `build-info.js` 会安全序列化 JSON，并转义 `<`，避免直接生成危险脚本片段。
- 这个包只收集构建期信息，不收集线上用户数据。

## 开发维护

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
node dist/cli.js generate
```

校验 GitHub Actions：

```bash
actionlint .github/workflows/*.yml
```

## FAQ

### 非 Git 仓库会失败吗？

不会。Git 字段会返回空字符串或空数组。

### 可以改全局变量名吗？

可以：

```bash
xbi generate --global-name __my_app__
```

React 组件同步传入：

```tsx
<BuildInfoPanel globalName="__my_app__" />
```

### Taro H5 怎么接？

在 H5 构建前执行：

```bash
xbi generate --env production --mode h5 && taro build --type h5
```
