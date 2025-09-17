/**
 * 执行日志路由
 * 提供任务执行记录的查询和管理接口
 */

const express = require('express');
const logStore = require('../services/log-store');
const { validate } = require('../middleware/validator');
const logger = require('../utils/logger');

const router = express.Router();

// 获取执行日志列表
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      taskId: req.query.taskId,
      deviceId: req.query.deviceId,
      status: req.query.status,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      limit: parseInt(req.query.limit) || 100
    };

    const logs = await logStore.filterLogs(filters);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// 清理旧日志
router.delete('/clean', async (req, res, next) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 30;
    const removedCount = await logStore.cleanOldLogs(daysToKeep);

    logger.info(`清理了 ${removedCount} 条旧日志`);
    res.json({
      success: true,
      removedCount,
      message: `成功清理 ${removedCount} 条超过 ${daysToKeep} 天的日志`
    });
  } catch (error) {
    next(error);
  }
});

// 获取日志统计信息
router.get('/stats', async (req, res, next) => {
  try {
    const logs = await logStore.getLogs();

    const stats = {
      total: logs.length,
      success: logs.filter(l => l.status === 'success').length,
      failed: logs.filter(l => l.status === 'failed').length,
      lastExecution: logs.length > 0 ? logs[0].timestamp : null
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// 获取最近的执行记录（用于任务显示最后执行状态）
router.get('/recent', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await logStore.getLogs();

    // 返回最近的执行记录
    const recentLogs = logs.slice(0, limit);
    res.json(recentLogs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;