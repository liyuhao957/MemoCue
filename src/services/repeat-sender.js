/**
 * 重复发送管理器
 * 负责处理任务的重复发送逻辑
 */

const logger = require('../utils/logger');

class RepeatSender {
  constructor() {
    // 存储正在执行重复发送的任务
    this.repeatingSendTasks = new Map();
    // 存储所有活动的定时器，用于清理
    this.activeTimers = new Map();
  }

  /**
   * 检查任务是否正在执行重复发送
   */
  isTaskRepeating(taskId) {
    return this.repeatingSendTasks.has(taskId);
  }

  /**
   * 获取重复发送配置
   */
  getRepeatConfig(task) {
    const enableRepeat = task.schedule?.enableRepeat &&
                         task.schedule?.type !== 'hourly' &&
                         task.schedule?.type !== 'cron';
    const repeatCount = enableRepeat ? (Number(task.schedule.repeatCount) || 1) : 1;
    const repeatInterval = enableRepeat ? (Number(task.schedule.repeatInterval) || 5) : 0;

    return { enableRepeat, repeatCount, repeatInterval };
  }

  /**
   * 标记任务开始重复发送
   */
  markTaskStarted(taskId, repeatCount, repeatInterval) {
    this.repeatingSendTasks.set(taskId, {
      startTime: new Date(),
      totalCount: repeatCount,
      currentCount: 0,
      interval: repeatInterval,
      aborted: false
    });
  }

  /**
   * 检查任务是否被中止
   */
  isTaskAborted(taskId) {
    const taskStatus = this.repeatingSendTasks.get(taskId);
    return taskStatus && taskStatus.aborted;
  }

  /**
   * 等待间隔时间
   */
  async waitInterval(taskId, intervalMinutes) {
    return new Promise((resolve) => {
      const timerId = setTimeout(resolve, intervalMinutes * 60 * 1000);
      // 存储定时器ID，以便清理
      if (!this.activeTimers.has(taskId)) {
        this.activeTimers.set(taskId, []);
      }
      this.activeTimers.get(taskId).push(timerId);
    });
  }

  /**
   * 清理任务的执行状态和定时器
   */
  cleanupTask(taskId) {
    // 清理重复发送状态
    if (this.repeatingSendTasks.has(taskId)) {
      this.repeatingSendTasks.delete(taskId);
      logger.info(`清理任务执行状态 - ID: ${taskId}`);
    }

    // 清理所有相关定时器
    if (this.activeTimers.has(taskId)) {
      const timers = this.activeTimers.get(taskId);
      timers.forEach(timerId => clearTimeout(timerId));
      this.activeTimers.delete(taskId);
      logger.info(`清理任务定时器 - ID: ${taskId}`);
    }
  }

  /**
   * 中止任务的重复发送
   */
  abortTask(taskId) {
    const taskStatus = this.repeatingSendTasks.get(taskId);
    if (taskStatus) {
      taskStatus.aborted = true;
      logger.info(`标记任务中止 - ID: ${taskId}`);
    }

    // 清理定时器，立即停止等待
    if (this.activeTimers.has(taskId)) {
      const timers = this.activeTimers.get(taskId);
      timers.forEach(timerId => clearTimeout(timerId));
      this.activeTimers.delete(taskId);
    }
  }

  /**
   * 清理所有任务（用于紧急情况）
   */
  clearAllTasks() {
    this.repeatingSendTasks.forEach((_, taskId) => {
      this.cleanupTask(taskId);
    });
  }

  /**
   * 获取当前正在执行重复发送的任务
   */
  getRepeatingSendTasks() {
    return Array.from(this.repeatingSendTasks.keys());
  }
}

// 导出单例
module.exports = new RepeatSender();