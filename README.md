# @xshuliner/build-info

`@xshuliner/build-info` 是一个构建期信息采集工具。它会在构建前生成 Git、CI、部署、运行时公开配置等信息，并输出到默认静态目录 `/__xshuliner__/`，页面运行时可以通过 `window.__xshuliner__` 读取，也可以用 React/Next.js 组件渲染。

它不会收集任何线上用户数据。所有信息都来自构建期，不会在浏览器运行时读取 Git 信息。

## 安装

```bash
pnpm add -D @xshuliner/build-info
```

要求 Node.js >= 20，包本身是 ESM only。

## CLI

```bash
xshuliner-build-info generate
xbi generate
```

默认输出：

```text
public/__xshuliner__/build-info.json
public/__xshuliner__/build-info.js
```

完整参数：

```bash
xbi generate \
  --out public/__xshuliner__ \
  --global-name __xshuliner__ \
  --app-name my-app \
  --app-version 1.0.0 \
  --env production \
  --mode client \
  --deploy-target production \
  --deploy-region global \
  --deploy-url https://example.com \
  --release-id prod-xxx \
  --build-id build-xxx
```

## Scripts 示例

```json
{
  "scripts": {
    "prebuild": "xbi generate --env production",
    "build": "vite build"
  }
}
```

## Vite 接入

```json
{
  "scripts": {
    "build": "xbi generate --env production --mode client && vite build"
  }
}
```

构建后页面可以加载：

```html
<script src="/__xshuliner__/build-info.js"></script>
```

然后在控制台执行：

```js
window.__xshuliner__
window.__xshuliner__.print()
```

## React 接入

```tsx
import { BuildInfoPanel } from '@xshuliner/build-info/react'

export function Footer() {
  return <BuildInfoPanel />
}
```

组件只在客户端读取 `window`。如果页面没有预先加载 `build-info.js`，它会 fetch `/__xshuliner__/build-info.json`。

```tsx
<BuildInfoPanel src="/custom/build-info.json" globalName="__custom__" compact />
```

## Next.js App Router

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

## Next.js Pages Router

```tsx
import { BuildInfoScript } from '@xshuliner/build-info/next'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <BuildInfoScript strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  )
}
```

## Taro H5

在 H5 构建命令前执行 `xbi generate`，让产物目录包含 `public/__xshuliner__`。Taro H5 页面中可以直接访问 `window.__xshuliner__`，React 组件也可以照常使用：

```bash
xbi generate --env production --mode h5 && taro build --type h5
```

## Node API

```ts
import { generateBuildInfo } from '@xshuliner/build-info/node'

await generateBuildInfo({
  outDir: 'public/__xshuliner__',
  globalName: '__xshuliner__',
  appName: 'my-app',
  env: 'production'
})
```

返回：

```ts
interface GenerateBuildInfoResult {
  info: BuildInfo
  jsonPath: string
  jsPath: string
}
```

## React API

```ts
interface BuildInfoPanelProps {
  src?: string
  globalName?: string
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}
```

默认：

```ts
src = '/__xshuliner__/build-info.json'
globalName = '__xshuliner__'
```

## Next.js API

```ts
interface BuildInfoScriptProps {
  src?: string
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'
}
```

默认输出：

```tsx
<Script src="/__xshuliner__/build-info.js" strategy="beforeInteractive" />
```

`next` 是 optional peerDependency，只有导入 `@xshuliner/build-info/next` 时才需要安装。

## 数据结构

```ts
interface BuildInfo {
  schemaVersion: string
  app: { name: string; version?: string; env: string; mode?: string }
  build: {
    time: string
    timestamp: number
    user?: string
    machine?: string
    nodeVersion?: string
    packageManager?: string
  }
  git: {
    branch?: string
    tag?: string
    nearestTag?: string
    commit: string
    shortCommit: string
    commitTime?: string
    dirty?: boolean
    remote?: string
    latestCommits: Array<{
      hash: string
      shortHash: string
      author: string
      date: string
      message: string
    }>
  }
  ci?: {
    provider?: string
    runId?: string
    runNumber?: string
    workflow?: string
    jobUrl?: string
    commitUrl?: string
  }
  deploy?: {
    target?: string
    region?: string
    url?: string
    releaseId?: string
    buildId?: string
  }
  runtime?: {
    apiBaseUrl?: string
    publicPath?: string
  }
}
```

## 信息来源

`app.name` 优先级：CLI `--app-name`、`XSHULINER_APP_NAME`、`package.json.name`、`unknown-app`。

`app.version` 优先级：CLI `--app-version`、`XSHULINER_APP_VERSION`、`package.json.version`、空字符串。

`app.env` 优先级：CLI `--env`、`XSHULINER_APP_ENV`、`NODE_ENV`、`development`。

`deploy.url` 优先级：CLI `--deploy-url`、`XSHULINER_DEPLOY_URL`、`VERCEL_PROJECT_PRODUCTION_URL`、`CF_PAGES_URL`。

运行时公开配置支持：

```text
XSHULINER_PUBLIC_API_BASE_URL
NEXT_PUBLIC_API_BASE_URL
VITE_API_BASE_URL
XSHULINER_PUBLIC_PATH
```

Git remote 会脱敏。比如：

```text
https://token@github.com/foo/bar.git -> https://github.com/foo/bar
git@github.com:foo/bar.git -> https://github.com/foo/bar
```

## GitHub Actions

本仓库已经迁移了公共 reusable workflows：

```text
.github/workflows/release-version.yml
.github/workflows/release-tag.yml
.github/workflows/release-deploy.yml
```

本包自己的 CI 使用 `.github/workflows/ci.yml` 串联：

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
node dist/cli.js generate --env ci --mode github-actions
pnpm pack
```

业务项目可在构建命令中采集 CI 信息：

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
      - run: xbi generate --env production --mode github-actions
      - run: pnpm build
```

手动发布包可使用 `.github/workflows/release-package.yml`。它会先跑质量检查和构建，再调用 `release-tag.yml` 计算并创建 tag；如果选择发布 npm，需要配置 `NPM_TOKEN`。

## 缓存策略

`build-info.js` 和 `build-info.json` 建议设置 no-store，避免页面看到旧部署信息。

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

## 安全注意事项

不要把 secret、token、私有环境变量写入 public runtime 信息。这个包只会读取明确列出的公开环境变量，但 CLI 参数也会进入公开文件，传参时要保持克制。

Git remote 会脱敏，但 commit message 可能包含敏感信息。公开站点如果对 commit message 有严格要求，可以在发布策略中约束提交内容，或在后续版本中增加自定义过滤。

`build-info.js` 会安全序列化 JSON，并转义 `<`，降低被内嵌到 HTML 时产生脚本注入的风险。

## FAQ

### 默认全局变量是什么？

`window.__xshuliner__`。

### 默认静态资源目录是什么？

`/__xshuliner__/`，对应项目中的 `public/__xshuliner__`。

### 浏览器会执行 Git 命令吗？

不会。Git、CI、部署信息都在构建期采集。

### 非 Git 仓库会失败吗？

不会。Git 信息会返回空字符串或空数组。

### 为什么页面看到旧信息？

通常是缓存导致。请给 `/__xshuliner__/*` 配置 `no-store`。

### 可以改全局变量名吗？

可以：

```bash
xbi generate --global-name __my_app__
```

React 组件同步传入：

```tsx
<BuildInfoPanel globalName="__my_app__" />
```

## Roadmap

- 支持自定义字段过滤器。
- 支持更多 CI provider 的深度链接。
- 支持生成 markdown 或 HTML 调试页。
