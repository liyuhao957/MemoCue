/**
 * 任务执行器
 * 负责任务的具体执行逻辑
 * 从 scheduler.js 中拆分出来以满足函数行数限制
 */

const providerFactory = require('../providers/provider-factory');
const fileStore = require('./file-store');
const logger = require('../utils/logger');
const { FILES, INTERVALS } = require('../config/constants');

class TaskExecutor {
  /**
   * 准备任务执行
   * @param {Object} task - 任务对象
   * @returns {Object} 准备好的执行参数
   */
  static async prepareExecution(task) {
    const devices = await fileStore.readJson(FILES.DEVICES, []);
    const targetDevices = devices.filter(d =>
      task.deviceIds.includes(d.id) && d.enabled
    );

    if (targetDevices.length === 0) {
      throw new Error('没有可用的推送设备');
    }

    return {
      task,
      devices: targetDevices,
      timestamp: new Date()
    };
  }

  /**
   * 发送推送通知
   * @param {Object} execution - 执行参数
   * @returns {Array} 推送结果
   */
  static async sendNotifications(execution) {
    const { task, devices } = execution;
    const results = [];

    for (const device of devices) {
      try {
        const provider = providerFactory.getProvider(device.type);
        const result = await provider.send({
          token: device.token,
          title: task.title,
          body: task.content,
          url: task.url,
          sound: task.sound,
          group: task.group,
          icon: task.icon,
          server: device.server
        });

        results.push({
          deviceId: device.id,
          success: true,
          result
        });

        logger.info(`推送成功 - 任务: ${task.id}, 设备: ${device.name}`);
      } catch (error) {
        results.push({
          deviceId: device.id,
          success: false,
          error: error.message
        });

        logger.error(`推送失败 - 任务: ${task.id}, 设备: ${device.name}`, error);
      }
    }

    return results;
  }

  /**
   * 处理执行结果
   * @param {Object} task - 任务对象
   * @param {Array} results - 执行结果
   * @param {Function} updateCallback - 更新回调
   */
  static async handleResults(task, results, updateCallback) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    await updateCallback(task.id);

    logger.info(`任务执行完成 - ID: ${task.id}`, {
      title: task.title,
      success: successCount,
      failure: failureCount,
      total: results.length
    });

    if (failureCount > 0) {
      const failedDevices = results
        .filter(r => !r.success)
        .map(r => r.deviceId);

      logger.warn(`部分设备推送失败 - 任务: ${task.id}`, failedDevices);
    }

    return {
      taskId: task.id,
      successCount,
      failureCount,
      timestamp: new Date()
    };
  }

  /**
   * 处理任务失败
   * @param {Object} job - 失败的任务
   * @param {Error} error - 错误信息
   * @param {Number} maxRetries - 最大重试次数
   * @returns {Object} 处理结果
   */
  static handleFailure(job, error, maxRetries) {
    logger.error(`任务执行失败 - ID: ${job.id}`, {
      error: error.message,
      retryCount: job.retryCount || 0
    });

    if (!job.retryCount) {
      job.retryCount = 0;
    }

    job.retryCount++;

    if (job.retryCount < maxRetries) {
      const retryDelay = Math.min(
        Math.pow(2, job.retryCount) * INTERVALS.RETRY_BASE,
        INTERVALS.MAX_RETRY_DELAY
      );

      logger.info(`任务将在 ${retryDelay}ms 后重试`, {
        taskId: job.id,
        retryCount: job.retryCount
      });

      return {
        shouldRetry: true,
        delay: retryDelay,
        retryCount: job.retryCount
      };
    }

    logger.error(`任务达到最大重试次数，放弃执行`, {
      taskId: job.id,
      maxRetries
    });

    return {
      shouldRetry: false,
      retryCount: job.retryCount
    };
  }
}

module.exports = TaskExecutor;