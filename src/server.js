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
const sseManager = require('./services/sse-manager');

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
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试'
      }
    });
  },
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

// SSE 实时推送端点（需要在普通路由之前注册）
app.get('/api/events', (req, res) => {
  logger.info('New SSE connection request');
  sseManager.addConnection(req, res);
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
    const cryptoUtil = require('./utils/crypto');
    // 使用与其他模块一致的默认密钥
    const encryptionSecret = process.env.ENCRYPTION_SECRET || 'default-secret-change-me';

    // 验证并处理任务数据
    if (tasks) {
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: '任务数据必须是数组格式' });
      }

      // 对每个任务进行基础验证和处理
      const validatedTasks = tasks.map(task => {
        // 确保必要字段存在
        if (!task.id || !task.title) {
          throw new Error('任务缺少必要字段');
        }

        // 确保时间字段存在
        task.createdAt = task.createdAt || new Date().toISOString();
        task.updatedAt = task.updatedAt || new Date().toISOString();

        // 确保布尔字段的类型正确
        task.enabled = Boolean(task.enabled);

        // 兼容新旧数据结构
        if (!task.schedule && task.scheduleType) {
          // 旧结构转新结构
          task.schedule = {
            type: task.scheduleType,
            value: task.scheduleValue
          };
        }

        return task;
      });

      await fileStore.writeJson('tasks.json', validatedTasks);
      logger.info('Tasks imported', { count: validatedTasks.length });
    }

    // 验证并处理设备数据
    if (devices) {
      if (!Array.isArray(devices)) {
        return res.status(400).json({ error: '设备数据必须是数组格式' });
      }

      // 对每个设备进行验证和密钥重新加密
      const validatedDevices = devices.map(device => {
        // 确保必要字段存在（使用正确的字段名）
        if (!device.id || !device.name || !device.providerType) {
          throw new Error('设备缺少必要字段');
        }

        // 重新加密设备配置（如果存在）
        if (device.providerConfig) {
          try {
            let decryptedConfig;

            // 如果是加密字符串，先解密
            if (typeof device.providerConfig === 'string') {
              // 尝试解密现有的加密配置
              decryptedConfig = cryptoUtil.decrypt(
                device.providerConfig,
                encryptionSecret
              );
              // 解密后应该是 JSON 字符串
              if (typeof decryptedConfig === 'string') {
                decryptedConfig = JSON.parse(decryptedConfig);
              }
            } else {
              // 如果是对象，直接使用
              decryptedConfig = device.providerConfig;
            }

            // 重新加密配置为字符串格式（与现有数据结构一致）
            const encryptedConfig = cryptoUtil.encrypt(
              JSON.stringify(decryptedConfig),
              encryptionSecret
            );

            // 保持字符串格式
            device.providerConfig = encryptedConfig;
          } catch (e) {
            // 如果解密失败，可能是未加密的对象，直接加密
            logger.warn('Failed to decrypt device config, encrypting as new', {
              deviceId: device.id,
              error: e.message
            });

            // 如果 providerConfig 是对象，加密它
            if (typeof device.providerConfig === 'object') {
              device.providerConfig = cryptoUtil.encrypt(
                JSON.stringify(device.providerConfig),
                encryptionSecret
              );
            }
            // 如果已经是加密字符串，保持原样
          }
        }

        // 确保时间字段存在
        device.createdAt = device.createdAt || new Date().toISOString();
        // 确保布尔字段存在
        device.isActive = device.isActive !== undefined ? device.isActive : true;

        return device;
      });

      await fileStore.writeJson('devices.json', validatedDevices);
      logger.info('Devices imported', { count: validatedDevices.length });
    }

    // 验证并处理分类数据
    if (categories) {
      if (!Array.isArray(categories)) {
        return res.status(400).json({ error: '分类数据必须是数组格式' });
      }

      // 对每个分类进行基础验证
      const validatedCategories = categories.map(category => {
        // 确保必要字段存在
        if (!category.id || !category.name) {
          throw new Error('分类缺少必要字段');
        }

        // 确保时间字段存在
        category.createdAt = category.createdAt || new Date().toISOString();

        return category;
      });

      // 确保默认分类存在
      const hasDefaultCategory = validatedCategories.some(c => c.id === 'default');
      if (!hasDefaultCategory) {
        validatedCategories.unshift({
          id: 'default',
          name: '默认分类',
          color: '#6b7280',
          icon: '📌',
          createdAt: new Date().toISOString()
        });
      }

      await fileStore.writeJson('categories.json', validatedCategories);
      logger.info('Categories imported', { count: validatedCategories.length });
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
    logger.error('Import failed', { error: error.message });
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
        env: 'unified',
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