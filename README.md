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
  appName: 'my-app',
  env: 'production'
})
```

## GitHub Actions 接入业务项目

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

这样生成的 `build-info.json` 会包含 GitHub Actions run、commit、branch 等构建期信息。

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

直接发布需要 npm 账号满足发布认证要求，例如开启 2FA，或使用允许发布的 granular access token。以后每次发布前都要先修改 `package.json` 里的 `version`，npm 不允许重复发布同一个版本号。

包第一次发布成功后，推荐改用 GitHub Actions + Trusted Publishing：

1. 在 npm 包页面配置 Trusted Publishing，指向这个仓库和 `.github/workflows/release-package.yml`。
2. 打开 GitHub `Actions` -> `Release Package`。
3. 确认 `package.json` 的 `version` 是本次要发布的新版本。
4. 选择版本类型和是否 `publish_to_npm`。
5. 运行 workflow；它会执行安装、lint、test、build、生成 build info、打包，并在发布时执行 `npm publish --access public`。

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
