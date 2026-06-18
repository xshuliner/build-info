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

正式发布或部署时，如果版本号由 tag 自增，推荐先完成版本解析，再生成 build info。`xbi generate` 读取应用版本的优先级是 `--app-version`、`XSHULINER_APP_VERSION`、当前工作区的 `package.json.version`；读取 tag 版本的优先级是 `--tag-version`、`XSHULINER_TAG_VERSION`、`XSHULINER_RELEASE_VERSION`、当前 Git checkout 能看到的 tag。

如果 tag 会在 build job 之后才创建，务必把 workflow 解析出的 tag 显式传给 `XSHULINER_TAG_VERSION` 或 `--tag-version`。这样 `tagVersion` 和 `git.nearestTag` 会使用本次 release 版本，而不是 `git describe` 在构建时看到的上一个 tag。

如果业务仓库复用 `release-tag.yml`，推荐顺序如下：

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: Version bump before release.
        required: true
        type: choice
        default: patch
        options:
          - patch
          - minor
          - major
          - none

permissions:
  contents: write

jobs:
  tag:
    uses: ./.github/workflows/release-tag.yml
    with:
      bump: ${{ inputs.bump }}

  build:
    needs: tag
    if: needs.tag.outputs.created == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ needs.tag.outputs.version }}
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          package-manager-cache: false
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - name: Sync package version for this build
        env:
          VERSION_NUMBER: ${{ needs.tag.outputs.version_number }}
        run: |
          node --input-type=module <<'NODE'
          import { readFile, writeFile } from 'node:fs/promises'

          const file = 'package.json'
          const version = process.env.VERSION_NUMBER
          const pkg = JSON.parse(await readFile(file, 'utf8'))
          pkg.version = version
          await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`)
          NODE
      - name: Generate build info
        env:
          XSHULINER_TAG_VERSION: ${{ needs.tag.outputs.version }}
          XSHULINER_RELEASE_VERSION: ${{ needs.tag.outputs.version }}
          XSHULINER_APP_VERSION: ${{ needs.tag.outputs.version_number }}
          XSHULINER_RELEASE_ID: ${{ needs.tag.outputs.version }}
          XSHULINER_BUILD_ID: ${{ github.run_number }}
        run: pnpm exec xbi generate --env production --mode github-actions
      - run: pnpm build
```

关键点是：`release-tag.yml` 先根据已有 tag 计算下一版并创建 tag；后续 build job checkout 这个 tag，把 `needs.tag.outputs.version_number` 临时写入当前工作区的 `package.json.version`，并把 `needs.tag.outputs.version` 传给 `XSHULINER_TAG_VERSION`，再执行 `xbi generate`。这样生成的 `build-info.json` 会拿到更新后的版本号和 tag，但仓库不会多出同步 `package.json` 的提交。

如果使用本仓库的 `release-deploy.yml`，workflow 会在 build job 里先创建一个不推送的本地 release tag，并在 `build_command` 环境中默认注入 `RELEASE_VERSION`、`RELEASE_VERSION_NUMBER`、`XSHULINER_TAG_VERSION`、`XSHULINER_RELEASE_VERSION` 和 `XSHULINER_APP_VERSION`。业务项目只要在前端构建前执行 `xbi generate`，就能让 `tagVersion`、`app.version` 和 `git.nearestTag` 对齐到同一个 resolved version；远端 tag 仍然在构建成功后由 tag job 推送。

如果不使用 reusable workflow，也保持同样原则：先得到单一版本来源，再把 tag 版本传给 `XSHULINER_TAG_VERSION`，把数字版本传给 `XSHULINER_APP_VERSION`，执行 `xbi generate`，最后运行前端构建。临时写入 `package.json.version` 只服务本次构建，不需要 `git commit`。

### Workflow 接入最佳实践

- 单一版本来源：release workflow 只输出 `version`（如 `v1.2.3`）和 `version_number`（如 `1.2.3`），业务项目不要再次自行计算。
- 版本变量命名：`XSHULINER_TAG_VERSION`/`XSHULINER_RELEASE_VERSION` 放 tag，`XSHULINER_APP_VERSION` 放无前缀版本，`XSHULINER_RELEASE_ID` 放部署追踪 id。
- checkout：需要 Git 信息的 job 使用 `actions/checkout` 并设置 `fetch-depth: 0`。
- 生成顺序：在前端构建命令之前运行 `xbi generate`，确保产物里的 `build-info.js` 和 `build-info.json` 跟随同一次构建。
- selector 顺序：`bump` 的 `workflow_dispatch` 选项统一为 `patch`、`minor`、`major`、`none`，默认值放第一；环境 selector 也按默认/高频环境优先，文档和 workflow 保持同序。
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
