/**
 * 任务执行器
 * 负责任务的具体执行逻辑
 * 从 scheduler.js 中拆分出来以满足函数行数限制
 */

const providerFactory = require('../providers/provider-factory');
const fileStore = require('./file-store');
const logStore = require('./log-store');
const repeatSender = require('./repeat-sender');
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

    // 兼容新旧数据格式：deviceId（单个）和 deviceIds（多个）
    const deviceIds = task.deviceIds || (task.deviceId ? [task.deviceId] : []);

    const targetDevices = devices.filter(d =>
      deviceIds.includes(d.id) && (d.enabled || d.isActive)
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
  async sendNotifications(execution) {
    const { task, devices } = execution;
    const results = [];

    // 检查任务是否正在执行重复发送
    if (repeatSender.isTaskRepeating(task.id)) {
      logger.warn(`任务正在执行重复发送，跳过本次触发 - 任务ID: ${task.id}`);
      return results;
    }

    // 获取重复发送配置
    const { enableRepeat, repeatCount, repeatInterval } = repeatSender.getRepeatConfig(task);

    logger.info(`准备推送任务 - ID: ${task.id}, 重复发送: ${enableRepeat}, 次数: ${repeatCount}, 间隔: ${repeatInterval}分钟`);

    // 如果启用重复发送，标记任务正在执行
    if (enableRepeat && repeatCount > 1) {
      repeatSender.markTaskStarted(task.id, repeatCount, repeatInterval);
    }

    // 执行重复发送
    for (let i = 0; i < repeatCount; i++) {
      // 检查任务是否被中止
      if (repeatSender.isTaskAborted(task.id)) {
        logger.info(`任务已被中止，停止重复发送 - 任务: ${task.id}`);
        break;
      }

      // 如果不是第一次发送，等待间隔时间
      if (i > 0) {
        logger.info(`等待 ${repeatInterval} 分钟后进行第 ${i + 1} 次重复发送 - 任务: ${task.id}`);
        await repeatSender.waitInterval(task.id, repeatInterval);

        // 再次检查是否被中止
        if (repeatSender.isTaskAborted(task.id)) {
          logger.info(`任务已被中止，停止重复发送 - 任务: ${task.id}`);
          break;
        }
      }

      logger.info(`开始第 ${i + 1}/${repeatCount} 次推送 - 任务: ${task.id}`);

      // 执行单次推送
      const iterationResults = await this.executeSingleIteration(task, devices, i + 1, repeatCount);
      results.push(...iterationResults);
    }

    // 重复发送完成后，清理执行状态和定时器
    repeatSender.cleanupTask(task.id);

    logger.info(`任务推送完成 - ID: ${task.id}, 总发送: ${results.length}次`);
    return results;
  }

  /**
   * 执行单次推送迭代
   */
  async executeSingleIteration(task, devices, iteration, totalIterations) {
    const results = [];

    for (const device of devices) {
      // 记录开始时间
      const startTime = Date.now();

      try {
        // 修复：使用正确的设备字段名称
        const providerType = device.providerType || device.type || 'bark';
        logger.debug(`使用推送提供者: ${providerType}, 设备: ${device.id}`);

        // 获取provider实例
        const provider = providerFactory.create(providerType);

        // 将设备对象和消息传给provider
        const result = await provider.send(device, {
          title: task.title,
          content: task.content,
          url: task.url,
          sound: task.sound,
          group: task.group,
          icon: task.icon,
          priority: task.priority
        });

        // 计算耗时
        const duration = Date.now() - startTime;

        results.push({
          deviceId: device.id,
          success: result.success,
          result,
          iteration
        });

        // 记录执行日志（包含耗时）
        await logStore.recordExecution({
          taskId: task.id,
          taskTitle: task.title,
          deviceId: device.id,
          deviceName: device.name,
          status: result.success ? 'success' : 'failed',
          error: result.success ? null : result.error,
          iteration,
          totalIterations,
          duration
        });

        if (result.success) {
          logger.info(`推送成功 - 任务: ${task.id}, 设备: ${device.name}, 第 ${iteration}/${totalIterations} 次`);
        } else {
          logger.warn(`推送失败 - 任务: ${task.id}, 设备: ${device.name}, 第 ${iteration}/${totalIterations} 次, 错误: ${result.error}`);
        }
      } catch (error) {
        // 计算耗时（即使失败也记录耗时）
        const duration = Date.now() - startTime;

        results.push({
          deviceId: device.id,
          success: false,
          error: error.message,
          iteration
        });

        // 记录执行失败日志（包含耗时）
        await logStore.recordExecution({
          taskId: task.id,
          taskTitle: task.title,
          deviceId: device.id,
          deviceName: device.name,
          status: 'failed',
          error: error.message,
          iteration,
          totalIterations,
          duration
        });

        logger.error(`推送异常 - 任务: ${task.id}, 设备: ${device.name}, 第 ${iteration}/${totalIterations} 次`, error);
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

// 创建单例实例
const taskExecutor = new TaskExecutor();

// 导出兼容静态方法的对象
module.exports = {
  // 保持静态方法接口
  prepareExecution: TaskExecutor.prepareExecution,
  handleFailure: TaskExecutor.handleFailure,
  handleResults: TaskExecutor.handleResults,

  // 使用实例方法，确保状态追踪
  sendNotifications: (execution) => taskExecutor.sendNotifications(execution),

  // 委托给 repeatSender 的方法
  cleanupTask: (taskId) => repeatSender.cleanupTask(taskId),
  abortTask: (taskId) => repeatSender.abortTask(taskId),
  clearAllTasks: () => repeatSender.clearAllTasks(),
  getRepeatingSendTasks: () => repeatSender.getRepeatingSendTasks()
};