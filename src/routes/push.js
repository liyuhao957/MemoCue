const express = require('express');
const fileStore = require('../services/file-store');
const logStore = require('../services/log-store');
const providerFactory = require('../providers/provider-factory');
const scheduler = require('../services/scheduler');
const { validate } = require('../middleware/validator');
const { NotFoundError } = require('../middleware/error');
const logger = require('../utils/logger');

const router = express.Router();

// 测试推送
router.post('/test', validate('pushTest'), async (req, res, next) => {
  try {
    const { deviceId, title, content, priority, sound } = req.body;

    // 获取设备
    const devices = await fileStore.readJson('devices.json', []);
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
      throw new NotFoundError('设备不存在');
    }

    // 获取推送提供者
    const provider = providerFactory.create(device.providerType);

    // 发送推送
    const message = {
      title,
      content,
      priority: priority || 0,
      sound: sound || 'default'
    };

    const result = await provider.send(device, message);

    logger.info('Test push sent', {
      deviceId,
      success: result.success
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 手动触发任务推送
router.post('/:taskId', async (req, res, next) => {
  try {
    const taskId = req.params.taskId;

    // 获取任务
    const tasks = await fileStore.readJson('tasks.json', []);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      throw new NotFoundError('任务不存在');
    }

    // 获取设备
    const devices = await fileStore.readJson('devices.json', []);
    const device = devices.find(d => d.id === task.deviceId);

    if (!device) {
      throw new NotFoundError('任务关联的设备不存在');
    }

    // 获取推送提供者
    const provider = providerFactory.create(device.providerType);

    // 发送推送
    const message = {
      title: task.title,
      content: task.content,
      priority: task.priority,
      sound: task.sound,
      icon: task.icon,
      group: task.group
    };

    const result = await provider.send(device, message);

    // 记录执行日志
    await logStore.recordExecution({
      taskId: task.id,
      taskTitle: task.title,
      deviceId: device.id,
      deviceName: device.name,
      status: result.success ? 'success' : 'failed',
      error: result.success ? null : result.error
    });

    // 更新最后推送时间
    if (result.success) {
      await fileStore.updateJson('tasks.json', (tasks) => {
        const t = tasks.find(task => task.id === taskId);
        if (t) {
          t.lastPushAt = new Date().toISOString();
        }
        return tasks;
      }, []);
    }

    logger.info('Manual push triggered', {
      taskId,
      success: result.success
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 获取调度器状态
router.get('/scheduler/status', async (req, res, next) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// 重新加载调度器
router.post('/scheduler/reload', async (req, res, next) => {
  try {
    await scheduler.reload();
    logger.info('Scheduler reloaded');
    res.json({ success: true, message: '调度器已重新加载' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;