# MemoCue

一个轻量级的定时提醒服务，通过 Bark API 向 iOS 设备发送精准的推送通知。

## 功能特性

- 📅 **灵活的定时规则** - 支持一次性、每日、每周、每月等多种定时模式
- 📱 **iOS推送通知** - 通过Bark服务发送即时推送到iOS设备
- 🏷️ **任务分类管理** - 支持自定义分类，便于组织管理任务
- 💾 **轻量级存储** - 使用JSON文件存储，无需数据库
- 🔐 **设备密钥加密** - 保护您的Bark设备密钥安全
- 🌐 **Web管理界面** - 简洁易用的单页应用管理界面

## 技术栈

- **后端**: Node.js + Express.js
- **前端**: Alpine.js + Tailwind CSS
- **任务调度**: node-cron
- **存储**: 文件系统 (JSON)
- **推送服务**: Bark API

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化数据

```bash
npm run data:init
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 使用说明

1. **添加设备**: 在管理界面添加您的Bark设备，需要提供设备名称和Bark密钥
2. **创建任务**: 设置任务标题、内容、选择设备和定时规则
3. **管理分类**: 创建自定义分类来组织您的提醒任务
4. **查看状态**: 实时查看任务执行状态和推送历史

## 定时规则类型

- **一次性提醒**: 在指定时间执行一次
- **每日提醒**: 每天固定时间执行
- **每周提醒**: 每周指定日期执行
- **每月提醒**: 每月指定日期执行
- **自定义Cron**: 使用标准Cron表达式

## 项目结构

```
MemoCue/
├── src/                # 后端源代码
│   ├── routes/         # API路由
│   ├── services/       # 业务逻辑
│   ├── middleware/     # 中间件
│   └── providers/      # 推送服务提供者
├── public/             # 前端静态文件
│   ├── js/            # JavaScript文件
│   └── css/           # 样式文件
├── scripts/           # 工具脚本
└── data/              # 数据存储目录
```

## API端点

- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `GET /api/devices` - 获取设备列表
- `POST /api/devices` - 添加设备
- `GET /api/categories` - 获取分类列表
- `POST /api/push/test` - 测试推送

## 环境配置

项目使用 `.env` 文件进行配置：

```env
PORT=3000                    # 服务端口
DATA_DIR=./data             # 数据目录
TZ=Asia/Shanghai            # 时区设置
LOG_LEVEL=info              # 日志级别
```

## 注意事项

- 本项目适合内网部署或个人使用
- 所有API端点均为公开访问，如需对外部署建议添加认证层
- 确保您的Bark服务正常运行
- 定时任务基于服务器时区执行

## License

MIT

## 贡献

欢迎提交Issue和Pull Request！