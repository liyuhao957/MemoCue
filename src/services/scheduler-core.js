/**
 * 调度器核心模块
 * 负责调度器的生命周期管理
 * 行数限制：150行以内
 */

const logger = require('../utils/logger');
const { SCHEDULER } = require('../config/constants');
const cron = require('node-cron');
const logCleaner = require('./log-cleaner');

class SchedulerCore {
  constructor() {
    this.jobs = new Map();
    this.timezone = process.env.TZ || SCHEDULER.CRON_TIMEZONE;
    this.isRunning = false;
    this.checkInterval = null;
    this.logCleanupJob = null;
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

    // 启动时清理残留的临时文件
    try {
      const tempStats = await logCleaner.cleanTempFiles();
      if (tempStats.removed > 0) {
        logger.info(`Cleaned ${tempStats.removed} temp files on startup`);
      }
    } catch (error) {
      // 清理失败不影响启动
      console.error('Startup temp cleanup failed:', error.message);
    }

    await loadTasksCallback();

    // 每分钟检查一次需要执行的任务
    this.checkInterval = setInterval(() => {
      checkTasksCallback();
    }, 60000);

    checkTasksCallback();

    // 启动日志清理任务（每2天凌晨2点执行）
    this.startLogCleanup();

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

    // 停止日志清理任务
    if (this.logCleanupJob) {
      this.logCleanupJob.stop();
      this.logCleanupJob = null;
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

  /**
   * 启动日志清理定时任务
   * 每2天凌晨2点执行一次
   */
  startLogCleanup() {
    try {
      // Cron表达式: 0 2 */2 * * 表示每2天的凌晨2点
      this.logCleanupJob = cron.schedule('0 2 */2 * *', async () => {
        try {
          await logCleaner.cleanAll();
          // 清理操作静默执行，不记录日志
        } catch (error) {
          // 错误也静默处理，避免干扰正常业务
          console.error('Log cleanup failed:', error.message);
        }
      }, {
        scheduled: true,
        timezone: this.timezone
      });
    } catch (error) {
      // 初始化失败不影响主服务
      console.error('Failed to start log cleanup job:', error.message);
    }
  }
}

module.exports = SchedulerCore;