require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 导入服务和工具
const logger = require('./utils/logger');
const scheduler = require('./services/scheduler');
const fileStore = require('./services/file-store');

// 导入中间件
const { errorHandler, notFoundHandler } = require('./middleware/error');

// 导入路由
const tasksRouter = require('./routes/tasks');
const devicesRouter = require('./routes/devices');
const categoriesRouter = require('./routes/categories');
const pushRouter = require('./routes/push');
const logsRouter = require('./routes/logs');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS 配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// 请求限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制100次请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// 请求解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    scheduler: scheduler.getStatus().isRunning
  });
});

// API 状态端点
app.get('/api/status', (req, res) => {
  res.json({
    version: '1.0.0',
    name: 'MemoCue Lite',
    description: '轻量级定时提醒服务',
    timezone: process.env.TZ || 'Asia/Shanghai'
  });
});

// 注册 API 路由
app.use('/api/tasks', tasksRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/push', pushRouter);
app.use('/api/logs', logsRouter);

// 导出/导入功能
app.get('/api/export', async (req, res, next) => {
  try {
    const data = {
      tasks: await fileStore.readJson('tasks.json', []),
      devices: await fileStore.readJson('devices.json', []),
      categories: await fileStore.readJson('categories.json', []),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="memocue-backup-${Date.now()}.json"`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post('/api/import', async (req, res, next) => {
  try {
    const { tasks, devices, categories } = req.body;

    if (tasks) {
      await fileStore.writeJson('tasks.json', tasks);
      logger.info('Tasks imported', { count: tasks.length });
    }

    if (devices) {
      await fileStore.writeJson('devices.json', devices);
      logger.info('Devices imported', { count: devices.length });
    }

    if (categories) {
      await fileStore.writeJson('categories.json', categories);
      logger.info('Categories imported', { count: categories.length });
    }

    // 重新加载调度器
    await scheduler.reload();

    res.json({
      success: true,
      imported: {
        tasks: tasks?.length || 0,
        devices: devices?.length || 0,
        categories: categories?.length || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// SPA 路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// 优雅关闭处理
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // 停止调度器
  scheduler.stop();

  // 关闭服务器
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // 如果10秒内没有关闭，强制退出
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// 启动服务器
let server;

async function startServer() {
  try {
    // 初始化文件存储
    await fileStore.ensureInit();

    // 启动调度器
    await scheduler.start();

    // 启动 HTTP 服务器
    server = app.listen(PORT, () => {
      logger.info(`MemoCue server started`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        timezone: process.env.TZ || 'Asia/Shanghai'
      });
      console.log(`
╔══════════════════════════════════════╗
║       MemoCue Lite Server            ║
║       轻量级定时提醒服务              ║
╠══════════════════════════════════════╣
║  状态: ✅ 运行中                      ║
║  端口: ${PORT}                          ║
║  地址: http://localhost:${PORT}         ║
╚══════════════════════════════════════╝
      `);
    });

    // 注册关闭信号处理
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 未捕获的异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason,
        promise
      });
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// 启动服务器
startServer();