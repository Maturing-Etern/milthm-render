# Milthm 网站部署指南

## 方案：Netlify 纯静态部署

本方案将 `milthm render/` 目录部署到 Netlify，所有账号相关功能（登录/注册/云存档）已禁用，核心查分功能不受影响。

---

## 方法一：拖拽上传（最快，无需 Git）

### 第一步：准备发布包

1. 打开 `milthm render/` 文件夹
2. **手动删除以下文件和目录**（Netlify 拖拽不支持 `.netlifyignore`）：
   - `calculator/fc.php` ⚠️ 含数据库密码，必须删除
   - `calculator/user/` 整个目录
   - `calculator/wtf/`
   - `calculator/changelog.php`
   - `calculator/submit.php`
   - `__serve.js`
   - `.netlifyignore`（本文件仅用于 Git 部署）
   - `.gitignore`
3. 将剩余文件打包为 ZIP（或直接拖拽文件夹）

### 第二步：部署到 Netlify

1. 访问 [netlify.com](https://netlify.com) 并登录
2. 进入 **Sites** → **Add new site** → **Deploy manually**
3. 将 `milthm render/` 文件夹直接拖拽到网页中
4. 等待上传完成（约 1-2 分钟）
5. 部署成功后，Netlify 会分配一个 `xxx.netlify.app` 的免费域名

### 第三步：绑定自定义域名（可选）

1. 在 Netlify 项目控制台 → **Domain Management**
2. 点击 **Add a domain**，输入你的域名
3. 按提示在域名服务商处添加 CNAME 记录

---

## 方法二：GitHub + Netlify（推荐，自动更新）

### 第一步：推送到 GitHub

```bash
# 在 milthm render/ 的父目录初始化 Git
cd "e:\HugoMoveData\User\lenovo\Downloads\MILTHM渲染版本及代码"

# 初始化仓库（如果还没有）
git init
git add "milthm render/"
git commit -m "Initial commit: Milthm website"

# 创建 GitHub 仓库后推送
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

> ⚠️ `.netlifyignore` 文件已配置，会自动排除 `fc.php`、`user/` 等敏感文件，无需手动删除。

### 第二步：连接 Netlify

1. 访问 [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. 选择 **GitHub**，授权后选择你的仓库
3. 配置部署选项：
   - **Build command**：留空（纯静态，无需构建）
   - **Publish directory**：`milthm render`（或 `.`，取决于仓库结构）
4. 点击 **Deploy**，等待部署完成

此后每次 `git push`，Netlify 会自动重新部署。

---

## 部署后检查清单

- [ ] 访问首页，确认三张卡片（Rain Player / MilLune Player / 查分器）正常显示
- [ ] 点击查分器卡片，能正常打开查分器页面
- [ ] 查分器能正常上传 ZIP 文件并解析（核心功能）
- [ ] 登录/注册按钮不可见（已通过 CSS 隐藏）
- [ ] 浏览器 Console 无红色错误（PHP 相关 404 应不存在）

---

## 常见问题

**Q：Netlify 部署后查分器页面 404？**
A：`netlify.toml` 中的 `publish` 路径配置错误。确认发布目录包含 `calculator/index.html`。

**Q：AVIF/WEBP 图片无法显示？**
A：`__serve.js` 是本地开发用的，Netlify 会自动处理这些格式的 MIME 类型，无需额外配置。`netlify.toml` 中的 headers 已声明缓存策略。

**Q：未来需要恢复账号功能怎么办？**
A：需要租用支持 PHP + MySQL 的服务器（如腾讯云轻量应用服务器），将完整的 `calculator/` 目录部署上去，并恢复 `fc.php` 中的数据库配置。

---

## 文件说明

| 文件 | 用途 |
|---|---|
| `.netlifyignore` | Git 部署时排除敏感文件 |
| `netlify.toml` | Netlify 部署配置（发布目录、缓存、重定向） |
| `DEPLOY.md` | 本部署说明文档 |
| `calculator/index.html` | 查分器主页面（已静态化，账号 UI 已隐藏） |
