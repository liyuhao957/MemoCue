# MemoCue Lite

<div align="center">

**轻量级定时提醒服务**

支持 iOS Bark 和飞书机器人推送的任务提醒工具

[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## ✨ 主要功能

### 定时提醒
- 支持多种定时模式：一次性、每日、每周、每月、间隔、Cron 表达式
- 重复发送：可配置重试次数和间隔时间
- 执行日志：记录每次推送的状态、耗时和错误信息

### 推送渠道
- **iOS Bark**：通过 Bark App 推送到 iPhone/iPad
- **飞书机器人**：支持群组机器人推送，可配置签名验证
- 多设备管理：支持添加多个推送设备并随时切换
- 推送测试：一键测试推送连通性

### 任务管理
- 任务分类：自定义分类，支持图标和颜色配置
- 拖拽排序：通过拖拽调整任务优先级
- 批量操作：支持批量启用、禁用和删除任务
- 实时状态：SSE 推送任务执行状态更新

### 数据管理
- 本地存储：所有数据存储在本地 JSON 文件
- 导入导出：支持数据备份和恢复，包含数据验证
- 原子写入：确保数据一致性和完整性

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

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/your-username/memocue-lite.git
cd memocue-lite

# 安装依赖
npm install

# 初始化数据
npm run data:init

# 启动服务
npm start
```

### 配置推送

#### iOS Bark
1. 安装 [Bark App](https://apps.apple.com/app/bark-customed-notifications/id1403753865)
2. 复制推送地址（格式：`https://api.day.app/你的密钥`）
3. 访问 [http://localhost:3000](http://localhost:3000)
4. 设备管理 → 添加设备 → 选择 Bark → 粘贴地址
5. 测试推送确认配置正确

#### 飞书机器人
1. 在飞书群组中添加自定义机器人
2. 复制 Webhook 地址
3. 访问 [http://localhost:3000](http://localhost:3000)
4. 设备管理 → 添加设备 → 选择飞书 → 粘贴 Webhook
5. 如有签名密钥请一并填写
6. 测试推送确认配置正确

## 📋 常用命令

| 命令 | 说明 | 使用场景 |
|------|------|----------|
| `npm start` | 启动开发服务器 | 日常开发和使用 |
| `npm run build` | 构建生产版本 | 部署前优化资源 |
| `npm run data:init` | 初始化数据和配置 | 首次安装或重置 |
| `npm run data:backup` | 创建数据快照 | 定期备份数据 |
| `npm run check` | 代码质量检查 | 开发时代码规范检查 |

## 📁 项目结构

```
MemoCue/
├── 📂 src/                    # 后端核心代码
│   ├── 🔧 config/            # 配置常量
│   ├── 🛡️ middleware/         # 中间件（认证、验证、错误处理）
│   ├── 🚀 providers/         # 推送服务提供者
│   ├── 🛣️ routes/            # API 路由定义
│   ├── ⚙️ services/          # 业务逻辑服务
│   ├── 🔨 utils/             # 工具函数
│   └── 🌟 server.js          # 应用入口
├── 📂 public/                 # 前端资源
│   ├── 🎨 styles/            # 样式文件
│   ├── 📜 js/                # JavaScript 模块
│   ├── 🧩 components/        # HTML 组件
│   └── 🏠 index.html         # 主页面
├── 📂 data/                   # 数据存储
│   ├── 📋 tasks.json         # 任务数据
│   ├── 📱 devices.json       # 设备配置
│   ├── 📂 categories.json    # 分类设置
│   └── 📂 logs/              # 执行日志
├── 📂 scripts/                # 工具脚本
│   ├── 🔧 init-data.js       # 数据初始化
│   └── 💾 backup.js          # 备份工具
└── 📄 package.json           # 项目配置
```

## ⚙️ 配置说明

### 环境变量配置

项目支持通过环境变量进行配置，可创建 `.env` 文件：

```bash
# 服务端口（可选，默认3000）
PORT=3000

# CORS 来源控制（可选，默认允许所有）
CORS_ORIGIN=*

# 加密密钥（推荐设置）
ENCRYPTION_SECRET=your-secret-key-here
```

### API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tasks` | GET/POST/PUT/DELETE | 任务管理 |
| `/api/devices` | GET/POST/DELETE | 设备管理 |
| `/api/categories` | GET/POST/PUT/DELETE | 分类管理 |
| `/api/push/:taskId` | POST | 测试推送 |
| `/api/logs` | GET | 获取执行日志 |
| `/events` | GET | SSE 实时事件流 |

## 🚀 部署指南

### 直接启动
```bash
# 启动服务（使用 nodemon，支持热重载）
npm start

# 构建前端资源（可选）
npm run build
```

### 使用 PM2 管理（推荐生产环境）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/server.js --name memocue

# 查看状态
pm2 status

# 查看日志
pm2 logs memocue

# 重启服务
pm2 restart memocue
```

### 安全建议

- 🔐 **设置加密密钥**：创建 `.env` 文件并设置 `ENCRYPTION_SECRET`
- 🌐 **网络访问控制**：设置 `CORS_ORIGIN` 限制访问来源
- 🔄 **定期备份**：使用 `npm run data:backup` 定期备份数据
- 📊 **监控日志**：定期检查 `data/logs/` 下的日志文件

## 🔧 故障排除

### 推送失败
- 检查推送地址是否完整正确
- 确认 Bark App 或飞书机器人状态正常
- 查看 `data/logs/error.log` 获取详细错误信息

### 定时任务不执行
- 确认任务状态为"启用"
- 检查系统时间和时区设置
- 验证 Cron 表达式是否正确（可用 [crontab.guru](https://crontab.guru) 验证）

### 数据丢失恢复
- 检查 `data/backup/` 目录的备份文件
- 查看 `data/*.json` 文件是否存在
- 如有 `.lock` 文件阻塞，可尝试删除

### 页面无法访问
- 确认服务已启动 (`npm start`)
- 检查端口占用（可更换端口：`PORT=3001 npm start`）
- 确认使用 http 而非 https 访问

## 🤝 贡献

欢迎提交 Issue 和 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
