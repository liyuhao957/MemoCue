/**
 * 调度器核心模块
 * 负责调度器的生命周期管理
 * 行数限制：150行以内
 */

const logger = require('../utils/logger');
const { SCHEDULER } = require('../config/constants');

class SchedulerCore {
  constructor() {
    this.jobs = new Map();
    this.timezone = process.env.TZ || SCHEDULER.CRON_TIMEZONE;
    this.isRunning = false;
    this.checkInterval = null;
  }

  /**
   * 启动调度器
   */
  async start(loadTasksCallback, checkTasksCallback) {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler', { timezone: this.timezone });
    this.isRunning = true;

    await loadTasksCallback();

    // 每分钟检查一次需要执行的任务
    this.checkInterval = setInterval(() => {
      checkTasksCallback();
    }, 60000);

    checkTasksCallback();
    logger.info('Scheduler started successfully');
  }

  /**
   * 停止调度器
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler');

    this.jobs.forEach((job, taskId) => {
      if (job.cronJob) {
        job.cronJob.stop();
      }
    });
    this.jobs.clear();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * 添加任务到调度器
   */
  addJob(taskId, job) {
    this.jobs.set(taskId, job);
  }

  /**
   * 获取任务
   */
  getJob(taskId) {
    return this.jobs.get(taskId);
  }

  /**
   * 移除任务
   */
  removeJob(taskId) {
    const job = this.jobs.get(taskId);
    if (job) {
      if (job.cronJob) {
        job.cronJob.stop();
      }
      this.jobs.delete(taskId);
      logger.info('任务已移除', { taskId });
    }
  }

  /**
   * 清空所有任务
   */
  clearJobs() {
    this.jobs.forEach((job) => {
      if (job.cronJob) {
        job.cronJob.stop();
      }
    });
    this.jobs.clear();
  }

  /**
   * 获取所有任务
   */
  getAllJobs() {
    return this.jobs;
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    const jobs = Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      title: job.task.title,
      scheduleType: job.task.scheduleType,
      nextPushAt: job.nextPushAt,
      enabled: job.task.enabled
    }));

    return {
      isRunning: this.isRunning,
      timezone: this.timezone,
      totalJobs: this.jobs.size,
      jobs
    };
  }

  /**
   * 获取时区
   */
  getTimezone() {
    return this.timezone;
  }

  /**
   * 是否正在运行
   */
  getIsRunning() {
    return this.isRunning;
  }
}

module.exports = SchedulerCore;