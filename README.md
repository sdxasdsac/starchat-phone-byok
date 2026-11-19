# 小手机 · BYOK

自带 API Key 的 AI 虚拟小手机。玻璃拟态桌面来自 StarChat 的 float-phone 外壳，聊天/人设/本地存储逻辑参考 missy-phone，接口协议与生图/PWA 能力参考 AI Virtual Phone。

**不内置任何模型额度，也没有账号和付费墙。** 每个用户点一次 Deploy，得到自己的 Vercel 网址，然后填自己的 API Key 就能用。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sdxasdsac/starchat-phone-byok&project-name=starchat-phone-byok)

点上面的按钮：GitHub 登录 Vercel → 自动 fork 到你自己的账号 → 自动构建 → 拿到 `https://xxx.vercel.app`。打开网址输入密钥，进「设置」填 API Key 即可使用。

首次打开需要输入专属访问密钥（格式 `XN-XXXX-XXXX-CCCC`，一人一个）。第一次激活会请求 `https://www.xingnian.site/api/access-key`，服务器把这个密钥标记为已用；第二台设备再用同一个密钥会被拒绝。激活成功后本机记住，之后打开不再询问。

校验接口可以用 `NEXT_PUBLIC_ACCESS_API` 覆盖；服务端代码在 `starchat-app/src/app/api/access-key/route.ts`，只把“密钥 → 已用设备”记在 `data/access-keys.json`，不依赖数据库。

服务器不可用时，新设备首次激活会提示“密钥服务暂时不可用”；已经激活过的设备不受影响。

批量生成密钥：

```bash
node scripts/gen-keys.mjs 100
```

会生成 100 个互不相同的密钥并写入 `小手机密钥.txt`。密钥由前端校验；换密钥规则时要同时修改 `src/lib/access.ts` 和 `scripts/gen-keys.mjs` 里的 `SALT`。

- 文字：OpenAI 兼容 `/chat/completions`（DeepSeek、OpenAI、各类中转站）
- 语音合成：火山引擎豆包语音合成 2.0 / MiniMax / OpenAI 兼容 / 浏览器自带朗读
- 语音识别：浏览器 Web Speech 优先；不支持时走 OpenAI 兼容 `/audio/transcriptions`
- 图像：OpenAI 兼容 `/images/generations`
- 数据：全部在浏览器 IndexedDB / localStorage，可导出 JSON 备份
- PWA：可添加到手机主屏幕，全屏运行

---

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

首次进入先输入访问密钥，再点桌面上的「设置」，填文字模型（Base URL + Key + 模型名），保存后即可聊天。语音和生图可以之后再配。

---

## 一键部署到 Vercel

### 1. 先把代码放到你的 GitHub

```bash
git init
git add .
git commit -m "feat: BYOK AI phone"
git branch -M main
git remote add origin https://github.com/<你的用户名>/starchat-phone-byok.git
git push -u origin main
```

### 2. 生成你自己的部署按钮

把下面这段放到任意分享页 / README 里，替换 `OWNER/REPO`：

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/OWNER/REPO&project-name=starchat-phone-byok)
```

用户点击后：

1. 用 GitHub 登录 Vercel（没有就现场注册）；
2. Vercel 自动 fork 一份代码到他自己的账号；
3. 自动构建，几分钟后拿到 `https://xxx.vercel.app`；
4. 打开网址，进「设置」填自己的 API Key，开始用。

**整个运行过程不经过任何人的服务器**：页面和 API 路由都跑在用户自己刚创建的 Vercel 项目里。

### 3. Vercel 配置（已内置）

仓库自带的 `vercel.json` 已经处理好：

- `framework: nextjs`，Vercel 自动识别构建命令，无需手动填；
- 部署区域 `hkg1`（香港），国内访问更快；
- 四个 API 路由（`llm / image / tts / stt`）`maxDuration: 60`，流式回复不会被 10 秒超时掐断；
- `sw.js` / `manifest.webmanifest` 不缓存，`/icons/*` 长缓存，PWA 更新能立刻生效。

一键部署后如果想换区域或加自定义域名，在 Vercel 项目 Settings → Functions / Domains 里改即可。

### 4. PWA 安装

部署完成后：

- **Android / 桌面 Chrome / Edge**：地址栏右侧「安装」图标，或菜单 → 安装「小手机」；应用内「主题 → 添加到主屏幕」也可以。
- **iPhone**：Safari 分享 → 添加到主屏幕。
- 安装后全屏运行、无浏览器地址栏，图标为 180/192/512 三档（iOS 用 `icon-180.png`，Android 用 maskable 图标）。
- 长按图标有「聊天 / 微信 / 朋友圈」快捷方式（`/?app=chat` 等）。
- Service Worker 缓存应用壳：无网也能打开桌面，聊天记录本来就在本地；API 请求不缓存。

### 5. 环境变量

默认一个都不需要。可选项：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | 桌面图标下显示的名字，默认「小手机」 |
| `NEXT_PUBLIC_API_MODE` | `proxy`（默认）或 `direct`；用户在设置里还能再改 |

`proxy`：请求走当前这个 Vercel 项目的 Serverless Function，用来绕过第三方 API 的 CORS；Key 只在单次请求里透传，不写日志、不落盘。
`direct`：浏览器直接请求第三方 API，完全不经过服务器，但部分中转站会被 CORS 拦。

---

## 首次使用

1. **设置 → 文字模型**：填 Base URL、API Key、模型名，点「测试连接」。
   - DeepSeek：`https://api.deepseek.com/v1` + `deepseek-chat`
   - OpenAI：`https://api.openai.com/v1` + `gpt-4o-mini`
2. **人设**：新建角色，或导入 SillyTavern JSON / PNG 角色卡、纯文本人设。
3. **聊天**：文字、图片、语音输入、朗读都在聊天页。
4. 可选：配置图像 API、语音合成、语音识别。
5. **朋友圈 / 小红薯**：用当前角色的人设生成动态与笔记。

---

## 功能清单

- 玻璃拟态手机外壳：状态栏、桌面网格、翻页、Dock、文件夹、时钟/日历组件、长按编辑、拖拽换位
- 聊天：流式回复、上下文记忆（最近 40 条）、图片消息、生图并发送、TTS 朗读、语音输入
- 人设：自定义字段、头像、开场白、示例对话、世界书、禁忌、音色；导入/导出
- 微信 / LINE：独立会话通道与皮肤，会话列表 + 聊天
- 朋友圈：角色生成动态、点赞、评论、让角色评论
- 小红薯：生成主页资料与笔记、笔记详情、点赞
- 设置：文字/图像/语音/语音识别四套 API、请求方式、我的人设、备份导入导出、清空数据
- 主题：9 套壁纸、恢复默认主题、PWA 安装入口
- PWA：manifest、Service Worker、离线壳缓存、一键安装、长按图标快捷方式

---

## 数据与隐私

- 角色、聊天、设置存在当前浏览器的 `localStorage`；生成的图片存在 `IndexedDB`。
- API Key 只存在本机浏览器，随请求发给对应的模型服务商。
- 服务端路由不写日志、不保存 Key、不保存聊天内容。
- 清理浏览器数据 / 换设备 / 换域名会导致本地数据不可用，请先「设置 → 导出备份」。

---

## 目录

```
src/app/                 页面、PWA manifest、API 路由
  api/llm/               文字模型透传（SSE 流式）
  api/tts/               火山 / MiniMax / OpenAI 语音合成
  api/image/             生图透传（b64_json / url 自动降级）
  api/stt/               语音识别透传
src/components/phone/    移植的 float-phone 外壳与桌面（视觉层）
src/components/os/       手机 OS、App 容器、聊天室
src/components/os/apps/  聊天 / 人设 / 设置 / 主题 / 朋友圈 / 小红薯
src/lib/                 本地存储、API 客户端、提示词、角色卡解析、媒体库
```

---

## 来源与许可

本项目是多个开源/自用项目的整合与改写：

- 玻璃外壳与桌面：StarChat 的 float-phone（移植自 AI Virtual Phone，许可以原仓库为准）
- 聊天结构、人设字段、本地优先思路：missy-phone-source（CC BY-NC-SA 4.0）
- 生图 / PWA / BYOK 协议：AI Virtual Phone（许可以原仓库为准）

如果你要商用，请先确认上游项目（尤其 missy-phone 的 CC BY-NC-SA 4.0）的许可范围。角色卡、字体、图标等第三方素材仍受各自条款约束。

---

## 免责声明

本项目不提供 AI 模型、API 额度或代理服务。用户需自行申请并承担第三方 API 的费用与合规责任。请勿把真实 API Key 写进公开仓库、截图或分享链接。
