# Memora 上线部署

Memora 上线分成两部分：

- 插件前端：打包成 zip，上传到 Chrome Web Store。
- 后端 API：部署到云服务，负责邀请码、记忆药水额度、AI 调用和学习记录。

不需要做完整官网。Chrome Web Store 审核需要一个公开隐私政策链接，所以仓库里只准备了一个极简静态页：`apps/site/privacy.html`。

## 推荐 MVP 架构

- 后端 API：Vercel Serverless Functions。
- 隐私政策页：Vercel 静态文件，路径是 `/privacy.html`。
- 数据库：Neon Postgres。
- 插件：Chrome Web Store。

## 1. 创建 Neon 数据库

1. 在 Neon 创建 `memora` 项目。
2. 复制 Neon 的 connection string，格式类似：

```text
postgresql://user:password@host.neon.tech/memora?sslmode=require
```

## 2. 部署 Vercel 项目

1. 把仓库推到 GitHub。
2. 在 Vercel 新建项目，选择 `milkbaek022/memora`。
3. Root Directory 留空，使用仓库根目录。
4. 设置环境变量：

```bash
DATABASE_URL=Neon connection string
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的新 DeepSeek Key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
MEMORA_MAIN_INVITE_CODE=你的主帐号邀请码
```

5. 部署完成后打开：

```text
https://你的-vercel-host/api/health
```

看到下面内容就说明后端已经在线：

```json
{"status":"ok","service":"memora-api"}
```

## 3. 创建普通邀请码

主帐号邀请码没有额度限制。普通邀请码默认 20 瓶记忆药水。

本地创建测试邀请码：

```bash
INVITE_CODE=BETA-001 npm run seed:invite --workspace @memora/api
```

线上创建普通邀请码时，在本地终端临时带上 Neon 连接串运行：

```bash
DATABASE_URL="你的 Neon connection string" INVITE_CODE=BETA-001 npm run seed:invite --workspace @memora/api
```

自定义瓶数：

```bash
DATABASE_URL="你的 Neon connection string" INVITE_CODE=BETA-002 INVITE_CREDITS=20 npm run seed:invite --workspace @memora/api
```

## 4. 隐私政策页

```text
https://你的-vercel-host/privacy.html
```

这个链接填到 Chrome Web Store 的隐私政策位置。

## 5. 打包 Chrome 插件

用生产 API 地址打包：

```bash
VITE_API_BASE_URL=https://你的-vercel-host npm run pack:store --workspace @memora/extension
```

打包完成后上传这个文件：

```text
apps/extension/memora-chrome-extension.zip
```

## 6. Chrome Web Store 提交

需要准备：

- 插件 zip：`apps/extension/memora-chrome-extension.zip`
- 隐私政策 URL：`https://你的-site-host/privacy.html`
- 插件名称：Memora
- 简短描述：Memora 记忆药水，用中文帮助你理解网页里的陌生概念。
- 权限说明：Memora 只在用户主动选中文字并触发学习时读取所选文字和必要上下文。
- 截图和图标：提交审核前需要补最终版商店素材。

提交后等待 Chrome Web Store 审核。审核通过后，用户从商店安装插件，输入邀请码即可使用，不需要本地运行后端。
