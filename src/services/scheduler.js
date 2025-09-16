/**
 * 任务调度器 - 重构版
 * 负责管理和执行定时任务
 * 行数限制：300行以内
 */

const cron = require('node-cron');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const fileStore = require('./file-store');
const logger = require('../utils/logger');
const TimeCalculator = require('./time-calculator');
const TaskExecutor = require('./task-executor');
const { FILES, SCHEDULER } = require('../config/constants');

// 配置 dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.timezone = process.env.TZ || SCHEDULER.CRON_TIMEZONE;
    this.isRunning = false;
    this.checkInterval = null;
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler', { timezone: this.timezone });
    this.isRunning = true;

    await this.loadAllTasks();

    // 每分钟检查一次需要执行的任务
    this.checkInterval = setInterval(() => {
      this.checkTasks();
    }, 60000);

    this.checkTasks();
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
   * 加载所有任务
   */
  async loadAllTasks() {
    try {
      const tasks = await fileStore.readJson(FILES.TASKS, []);
      const enabledTasks = tasks.filter(task => task.enabled);

      logger.info('Loading tasks', {
        total: tasks.length,
        enabled: enabledTasks.length
      });

      for (const task of enabledTasks) {
        await this.scheduleTask(task);
      }
    } catch (error) {
      logger.error('Failed to load tasks', { error: error.message });
    }
  }

  /**
   * 检查需要执行的任务
   */
  async checkTasks() {
    const now = dayjs().tz(this.timezone);

    for (const [taskId, job] of this.jobs) {
      if (job.nextPushAt && dayjs(job.nextPushAt).isBefore(now)) {
        await this.executeTask(taskId);
      }
    }
  }

  /**
   * 调度单个任务
   */
  async scheduleTask(task) {
    try {
      if (!task.enabled) {
        this.removeTask(task.id);
        return;
      }

      const nextPushAt = this.calculateNextPushTime(task);

      if (!nextPushAt) {
        logger.warn('无法计算下次推送时间', { taskId: task.id });
        return;
      }

      const job = {
        id: task.id,
        task,
        nextPushAt,
        createdAt: new Date()
      };

      // 对于cron类型任务，创建定时任务
      if (task.scheduleType === 'cron' && task.scheduleValue) {
        const cronJob = cron.schedule(task.scheduleValue, async () => {
          await this.executeTask(task.id);
        }, {
          scheduled: true,
          timezone: this.timezone
        });
        job.cronJob = cronJob;
      }

      this.jobs.set(task.id, job);
      await this.updateTaskNextPushAt(task.id, nextPushAt);

      logger.info('任务已调度', {
        taskId: task.id,
        nextPushAt,
        scheduleType: task.scheduleType
      });
    } catch (error) {
      logger.error('任务调度失败', {
        taskId: task.id,
        error: error.message
      });
    }
  }

  /**
   * 移除任务
   */
  removeTask(taskId) {
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
   * 执行任务
   */
  async executeTask(taskId) {
    const job = this.jobs.get(taskId);
    if (!job) {
      logger.warn('任务不存在', { taskId });
      return;
    }

    try {
      logger.info('开始执行任务', {
        taskId,
        title: job.task.title
      });

      // 使用TaskExecutor执行任务
      const execution = await TaskExecutor.prepareExecution(job.task);
      const results = await TaskExecutor.sendNotifications(execution);
      await TaskExecutor.handleResults(
        job.task,
        results,
        (id) => this.updateTaskLastPushAt(id)
      );

      // 计算并更新下次执行时间
      if (job.task.scheduleType !== 'once') {
        const nextPushAt = this.calculateNextPushTime(job.task);
        if (nextPushAt) {
          job.nextPushAt = nextPushAt;
          await this.updateTaskNextPushAt(taskId, nextPushAt);
        }
      } else {
        // 单次任务执行后禁用
        await this.disableTask(taskId);
        this.removeTask(taskId);
      }
    } catch (error) {
      this.handleTaskFailure(job, error);
    }
  }

  /**
   * 处理任务失败
   */
  handleTaskFailure(job, error) {
    const result = TaskExecutor.handleFailure(
      job,
      error,
      SCHEDULER.MAX_RETRIES
    );

    if (result.shouldRetry) {
      setTimeout(() => {
        this.executeTask(job.id);
      }, result.delay);
    } else {
      this.removeTask(job.id);
    }
  }

  /**
   * 计算下次推送时间 - 使用TimeCalculator
   */
  calculateNextPushTime(task) {
    const { scheduleType, scheduleValue } = task;

    switch (scheduleType) {
      case 'once':
        return new Date(scheduleValue) > new Date()
          ? new Date(scheduleValue)
          : null;

      case 'daily':
        return TimeCalculator.calculateDaily(scheduleValue.times);

      case 'weekly':
        return TimeCalculator.calculateWeekly(
          scheduleValue.weekDays,
          scheduleValue.time
        );

      case 'monthly':
        return TimeCalculator.calculateMonthly(
          scheduleValue.days,
          scheduleValue.time
        );

      case 'interval':
        return TimeCalculator.calculateInterval(
          scheduleValue.interval,
          task.lastPushAt
        );

      case 'workdays':
        return TimeCalculator.calculateWorkdays(scheduleValue.times);

      case 'weekend':
        return TimeCalculator.calculateWeekend(scheduleValue.times);

      case 'cron':
        return TimeCalculator.calculateCron(scheduleValue);

      case 'custom':
        return TimeCalculator.calculateCustom(scheduleValue.dates);

      default:
        logger.warn('未知的调度类型', {
          taskId: task.id,
          scheduleType
        });
        return null;
    }
  }

  /**
   * 更新任务的下次推送时间
   */
  async updateTaskNextPushAt(taskId, nextPushAt) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.nextPushAt = nextPushAt;
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    });
  }

  /**
   * 更新任务的上次推送时间
   */
  async updateTaskLastPushAt(taskId) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.lastPushAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    });
  }

  /**
   * 禁用任务
   */
  async disableTask(taskId) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.enabled = false;
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    });
  }

  /**
   * 重新加载任务
   */
  async reload() {
    logger.info('Reloading scheduler');

    this.jobs.forEach((job) => {
      if (job.cronJob) {
        job.cronJob.stop();
      }
    });
    this.jobs.clear();

    await this.loadAllTasks();
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
}

module.exports = new Scheduler();