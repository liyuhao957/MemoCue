# MemoCue

<div align="center">

**智能定时提醒服务**

支持 iOS Bark 和飞书机器人推送的任务提醒工具

[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[📖 文档](./README.md) | [🚀 部署指南](./DEPLOYMENT_GUIDE.md) | [📦 下载](https://github.com/liyuhao957/memocue/releases)

</div>

## ✨ 主要功能

### 定时提醒
- 支持多种定时模式：一次性、每天、每周、每月、每小时、Cron 表达式
- 重复发送：可配置1-10次重复推送，间隔1-60分钟
- 执行日志：记录每次推送的状态、耗时和错误信息

### 推送渠道
- **iOS Bark**：通过 Bark App 推送到 iPhone/iPad
  - 支持25种提示音选择（闹钟、铃声、水晶等）
  - 支持点击通知跳转 URL
- **飞书机器人**：支持群组机器人推送
  - 支持卡片消息格式
  - 可配置优先级（普通/中等/高）
  - 支持链接 URL 按钮
  - 可选签名验证
- 多设备管理：支持添加多个推送设备并随时切换
- 推送测试：一键测试推送连通性

### 任务管理
- 任务分类：自定义分类，支持图标和颜色配置
- 拖拽排序：通过拖拽调整任务优先级
- 批量操作：支持批量启用、禁用和删除任务
- 实时状态：SSE 推送任务执行状态更新
- 智能提示：输入时显示字符宽度，便于控制标题长度

### 数据管理
- 本地存储：所有数据存储在本地 JSON 文件
- 导入导出：支持数据备份和恢复，包含数据验证
- 原子写入：确保数据一致性和完整性
- 日志管理：自动清理过期日志，执行日志限制500条

## 📸 界面预览

<div align="center">
  <img src="screenshots/dashboard.png" alt="提醒面板" width="80%">
  <p><i>主界面 - 提醒面板，展示分类管理、任务执行状态和今日概览</i></p>
</div>

<div align="center">
  <img src="screenshots/task-editor.png" alt="新建提醒" width="80%">
  <p><i>任务编辑器 - 创建和编辑定时提醒任务</i></p>
</div>

<div align="center">
  <img src="screenshots/device-management.png" alt="设备管理" width="80%">
  <p><i>设备管理 - 配置和管理推送设备（Bark、飞书等）</i></p>
</div>

## 🛠️ 技术栈

| 分类 | 技术选型 | 说明 |
|------|----------|------|
| **后端** | Node.js + Express | 轻量级 Web 服务器 |
| | node-cron | 定时任务调度 |
| | winston | 结构化日志记录 |
| **前端** | Alpine.js | 轻量级响应式框架 |
| | Tailwind CSS | 实用优先的 CSS 框架 |
| | Day.js | 轻量级日期处理库 |
| **工具链** | esbuild | 快速构建工具 |
| | proper-lockfile | 文件锁机制 |
| | write-file-atomic | 原子文件写入 |

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18.0.0
- iOS 用户需安装 [Bark App](https://apps.apple.com/app/bark-customed-notifications/id1403753865)
- 飞书用户需创建自定义机器人

### 快速体验

```bash
# 1. 克隆并安装
git clone https://github.com/liyuhao957/memocue.git
cd memocue && npm install

# 2. 初始化数据（自动生成配置和加密密钥）
npm run data:init

# 3. 启动服务
npm start

# 4. 打开浏览器
# 访问 http://localhost:3000
```

#### 数据初始化说明

`npm run data:init` 命令会自动完成以下配置：

- **创建数据目录**：生成 `data/` 和 `data/logs/` 目录
- **初始化数据文件**：
  - `tasks.json` - 任务存储
  - `devices.json` - 设备配置
  - `categories.json` - 默认分类（默认、工作、个人、重要）
- **生成 .env 文件**：
  - 自动生成 32 字节随机加密密钥
  - 配置服务端口、时区、日志级别等
  - 如文件已存在则跳过，不会覆盖

⚠️ **注意**：此命令只需在首次安装时运行一次


### 配置推送

#### iOS Bark
1. 安装 [Bark App](https://apps.apple.com/app/bark-customed-notifications/id1403753865)
2. 复制推送地址（格式：`https://api.day.app/你的密钥`）
3. 访问 [http://localhost:3000](http://localhost:3000)
4. 设备管理 → 添加设备 → 选择 Bark → 粘贴地址
5. 测试推送确认配置正确

**Bark 高级功能**：
- 创建任务时可选择不同的提示音
- 设置点击通知后跳转的 URL 链接

#### 飞书机器人
1. 在飞书群组中添加自定义机器人
2. 复制 Webhook 地址
3. 访问 [http://localhost:3000](http://localhost:3000)
4. 设备管理 → 添加设备 → 选择飞书 → 粘贴 Webhook
5. 如有签名密钥请一并填写
6. 测试推送确认配置正确

**飞书高级功能**：
- 支持卡片消息格式，显示更丰富
- 可设置消息优先级（高优先级为红色）
- 支持添加"查看详情"按钮跳转链接

## ⚙️ 配置说明

### 环境变量配置

`.env` 文件可通过 `npm run data:init` 自动生成，也可手动创建：

```bash
PORT=3000  # 服务端口
ENCRYPTION_SECRET=your-random-32-character-string-here  # 加密密钥（自动生成或手动设置）
LOG_RETENTION_DAYS=2  # 日志保留天数（默认2天）
TZ=Asia/Shanghai  # 时区设置
LOG_LEVEL=info  # 日志级别：debug/info/warn/error
```

#### 关于加密密钥

`ENCRYPTION_SECRET` 用于加密存储推送设备的敏感信息（如 Bark 密钥、飞书 Webhook），防止配置泄露：

- **自动生成**：运行 `npm run data:init` 会生成一个安全的随机密钥
- **手动设置**：可以使用任意 32 字符以上的随机字符串
- **安全建议**：
  - 个人本地使用可保持默认
  - 服务器部署强烈建议设置独特密钥
  - 切勿将 `.env` 文件提交到版本控制

### 日志清理
- **自动清理**：每2天凌晨2点自动清理过期日志
- **文件日志**：保留最近2天的 `app.log` 和 `error.log`
- **执行日志**：`logs.json` 自动保持最新500条记录
- **临时文件**：启动时清理超过1小时的 `.tmp` 文件

## 🚀 部署指南

### 快速部署（PM2）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/server.js --name memocue

# 设置开机自启
pm2 startup
pm2 save
```

### 生产环境部署

详细的生产环境部署指南请参考 [**部署文档**](./DEPLOYMENT_GUIDE.md)，包括：

- ✅ **多种部署方式**：独立服务、Nginx 反向代理、Docker 容器化
- ✅ **子路径部署**：在现有网站下部署（如 `/memocue`）
- ✅ **HTTPS 配置**：使用 Let's Encrypt 免费证书
- ✅ **性能优化**：PM2 集群模式、日志轮转、内存限制
- ✅ **备份恢复**：自动备份脚本和数据恢复流程
- ✅ **故障排查**：常见问题和解决方案

## 🔧 故障排除

- **推送失败**：检查推送地址、查看 `data/logs/error.log`
- **定时不执行**：确认任务启用、检查系统时间、验证 Cron 表达式
- **数据恢复**：检查 `data/backup/` 目录
- **无法访问**：确认服务启动、检查端口占用
- **日志过大**：系统会自动清理，也可手动删除 `data/logs/` 下的日志文件


## 📞 支持

- 提交 [Issue](https://github.com/liyuhao957/memocue/issues) 报告问题

---

<div align="center">
Made with ❤️ by <a href="https://github.com/liyuhao957">liyuhao957</a>
</div>
