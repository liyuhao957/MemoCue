/**
 * 执行日志存储服务
 * 负责管理任务执行记录的持久化和查询
 */

const fileStore = require('./file-store');
const logger = require('../utils/logger');
const { FILES } = require('../config/constants');
const sseManager = require('./sse-manager');

class LogStore {
  constructor() {
    this.maxLogs = 1000; // 最多保存1000条记录
    this.logsFile = 'logs.json';
  }

  /**
   * 记录任务执行日志
   * @param {Object} logEntry - 日志条目
   * @returns {Promise<void>}
   */
  async recordExecution(logEntry) {
    try {
      const logs = await this.getLogs();

      // 构建完整的日志记录
      const record = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId: logEntry.taskId,
        taskTitle: logEntry.taskTitle,
        deviceId: logEntry.deviceId,
        deviceName: logEntry.deviceName,
        status: logEntry.status, // 'success' | 'failed'
        error: logEntry.error || null,
        timestamp: new Date().toISOString(),
        iteration: logEntry.iteration || 1,
        totalIterations: logEntry.totalIterations || 1,
        duration: logEntry.duration || 0 // 推送耗时（毫秒）
      };

      // 添加新记录到开头
      logs.unshift(record);

      // 限制日志数量
      if (logs.length > this.maxLogs) {
        logs.splice(this.maxLogs);
      }

      await fileStore.writeJson(this.logsFile, logs);
      logger.debug('执行日志已记录', record);

      // 实时推送日志到前端
      sseManager.pushExecutionLog(record);
    } catch (error) {
      logger.error('记录执行日志失败', error);
    }
  }

  /**
   * 获取所有日志
   * @returns {Promise<Array>}
   */
  async getLogs() {
    try {
      return await fileStore.readJson(this.logsFile, []);
    } catch (error) {
      logger.error('读取执行日志失败', error);
      return [];
    }
  }

  /**
   * 获取任务的最近执行记录
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object|null>}
   */
  async getLastExecutionForTask(taskId) {
    try {
      const logs = await this.getLogs();
      return logs.find(log => log.taskId === taskId) || null;
    } catch (error) {
      logger.error('获取任务最近执行记录失败', error);
      return null;
    }
  }

  /**
   * 获取多个任务的最近执行记录
   * @param {Array<string>} taskIds - 任务ID列表
   * @returns {Promise<Map>}
   */
  async getLastExecutionsForTasks(taskIds) {
    try {
      const logs = await this.getLogs();
      const executionMap = new Map();

      for (const taskId of taskIds) {
        const lastLog = logs.find(log => log.taskId === taskId);
        if (lastLog) {
          executionMap.set(taskId, lastLog);
        }
      }

      return executionMap;
    } catch (error) {
      logger.error('获取多个任务执行记录失败', error);
      return new Map();
    }
  }

  /**
   * 按条件筛选日志
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Array>}
   */
  async filterLogs(filters = {}) {
    try {
      let logs = await this.getLogs();

      // 按任务ID筛选
      if (filters.taskId) {
        logs = logs.filter(log => log.taskId === filters.taskId);
      }

      // 按设备ID筛选
      if (filters.deviceId) {
        logs = logs.filter(log => log.deviceId === filters.deviceId);
      }

      // 按状态筛选
      if (filters.status) {
        logs = logs.filter(log => log.status === filters.status);
      }

      // 按时间范围筛选
      if (filters.startTime || filters.endTime) {
        const start = filters.startTime ? new Date(filters.startTime) : new Date(0);
        const end = filters.endTime ? new Date(filters.endTime) : new Date();

        logs = logs.filter(log => {
          const logTime = new Date(log.timestamp);
          return logTime >= start && logTime <= end;
        });
      }

      // 限制返回数量
      if (filters.limit) {
        logs = logs.slice(0, filters.limit);
      }

      return logs;
    } catch (error) {
      logger.error('筛选执行日志失败', error);
      return [];
    }
  }

  /**
   * 清理旧日志
   * @param {number} daysToKeep - 保留天数
   * @returns {Promise<number>} 清理的记录数
   */
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const logs = await this.getLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filteredLogs = logs.filter(log =>
        new Date(log.timestamp) > cutoffDate
      );

      const removedCount = logs.length - filteredLogs.length;

      if (removedCount > 0) {
        await fileStore.writeJson(this.logsFile, filteredLogs);
        logger.info(`清理了 ${removedCount} 条旧日志`);
      }

      return removedCount;
    } catch (error) {
      logger.error('清理旧日志失败', error);
      return 0;
    }
  }
}

module.exports = new LogStore();