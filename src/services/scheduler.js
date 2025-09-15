const cron = require('node-cron');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const fileStore = require('./file-store');
const providerFactory = require('../providers/provider-factory');
const logger = require('../utils/logger');

// 配置 dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.timezone = process.env.TZ || 'Asia/Shanghai';
    this.isRunning = false;
    this.checkInterval = null;
  }

  // 启动调度器
  async start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler', { timezone: this.timezone });
    this.isRunning = true;

    // 加载所有任务
    await this.loadAllTasks();

    // 每分钟检查一次需要执行的任务
    this.checkInterval = setInterval(() => {
      this.checkTasks();
    }, 60000);

    // 立即执行一次检查
    this.checkTasks();

    logger.info('Scheduler started successfully');
  }

  // 停止调度器
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler');

    // 清除所有定时任务
    this.jobs.forEach((job, taskId) => {
      if (job.cronJob) {
        job.cronJob.stop();
      }
    });
    this.jobs.clear();

    // 清除检查间隔
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  // 加载所有任务
  async loadAllTasks() {
    try {
      const tasks = await fileStore.readJson('tasks.json', []);
      const enabledTasks = tasks.filter(task => task.enabled);

      logger.info('Loading tasks', { total: tasks.length, enabled: enabledTasks.length });

      for (const task of enabledTasks) {
        await this.scheduleTask(task);
      }
    } catch (error) {
      logger.error('Failed to load tasks', { error: error.message });
    }
  }

  // 检查需要执行的任务
  async checkTasks() {
    const now = dayjs().tz(this.timezone);

    for (const [taskId, job] of this.jobs) {
      if (job.nextPushAt && dayjs(job.nextPushAt).isBefore(now)) {
        await this.executeTask(taskId);
      }
    }
  }

  // 调度单个任务
  async scheduleTask(task) {
    try {
      // 移除已存在的任务
      this.removeTask(task.id);

      // 计算下次执行时间
      const nextPushAt = this.calculateNextPushTime(task);
      if (!nextPushAt) {
        logger.info('Task has no future execution time', { taskId: task.id });
        return;
      }

      // 创建任务记录
      const job = {
        task,
        nextPushAt: nextPushAt.toISOString(),
        retryCount: 0
      };

      // 如果是 cron 表达式，创建 cron 任务
      if (task.schedule.type === 'cron') {
        const cronJob = cron.schedule(
          task.schedule.expression,
          () => this.executeTask(task.id),
          {
            scheduled: true,
            timezone: task.schedule.timezone || this.timezone
          }
        );
        job.cronJob = cronJob;
      }

      this.jobs.set(task.id, job);

      // 更新任务的下次执行时间
      await this.updateTaskNextPushAt(task.id, nextPushAt.toISOString());

      logger.info('Task scheduled', {
        taskId: task.id,
        title: task.title,
        nextPushAt: nextPushAt.format()
      });
    } catch (error) {
      logger.error('Failed to schedule task', {
        taskId: task.id,
        error: error.message
      });
    }
  }

  // 移除任务
  removeTask(taskId) {
    const job = this.jobs.get(taskId);
    if (job) {
      if (job.cronJob) {
        job.cronJob.stop();
      }
      this.jobs.delete(taskId);
      logger.info('Task removed from scheduler', { taskId });
    }
  }

  // 执行任务
  async executeTask(taskId) {
    try {
      const job = this.jobs.get(taskId);
      if (!job) {
        logger.warn('Task not found in scheduler', { taskId });
        return;
      }

      const { task } = job;
      logger.info('Executing task', { taskId, title: task.title });

      // 获取设备信息
      const devices = await fileStore.readJson('devices.json', []);
      const device = devices.find(d => d.id === task.deviceId);

      if (!device) {
        logger.error('Device not found for task', { taskId, deviceId: task.deviceId });
        return;
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

      if (result.success) {
        // 更新最后推送时间
        await this.updateTaskLastPushAt(taskId);

        // 重新计算下次执行时间
        const nextPushAt = this.calculateNextPushTime(task);
        if (nextPushAt) {
          job.nextPushAt = nextPushAt.toISOString();
          await this.updateTaskNextPushAt(taskId, nextPushAt.toISOString());
        } else {
          // 任务已完成，移除
          this.removeTask(taskId);
          await this.disableTask(taskId);
        }

        // 重置重试计数
        job.retryCount = 0;
      } else {
        // 推送失败，进行重试
        await this.handleTaskFailure(taskId, result.error);
      }
    } catch (error) {
      logger.error('Failed to execute task', {
        taskId,
        error: error.message,
        stack: error.stack
      });
      await this.handleTaskFailure(taskId, error.message);
    }
  }

  // 处理任务失败
  async handleTaskFailure(taskId, error) {
    const job = this.jobs.get(taskId);
    if (!job) return;

    job.retryCount = (job.retryCount || 0) + 1;
    const maxRetries = job.task.maxRetries || 3;

    if (job.retryCount < maxRetries) {
      // 指数退避重试
      const retryDelay = Math.min(Math.pow(2, job.retryCount) * 1000, 30000);
      logger.info('Retrying task', {
        taskId,
        retryCount: job.retryCount,
        retryDelay
      });

      setTimeout(() => this.executeTask(taskId), retryDelay);
    } else {
      logger.error('Task failed after max retries', {
        taskId,
        maxRetries,
        error
      });
      // 可以选择禁用任务或发送管理员通知
    }
  }

  // 计算下次执行时间
  calculateNextPushTime(task) {
    const now = dayjs().tz(this.timezone);
    const schedule = task.schedule;

    switch (schedule.type) {
      case 'once':
        const onceTime = dayjs(schedule.datetime).tz(this.timezone);
        return onceTime.isAfter(now) ? onceTime : null;

      case 'hourly':
        const nextHour = now.add(1, 'hour').minute(schedule.minute).second(0);
        if (schedule.startHour !== undefined && schedule.endHour !== undefined) {
          const hour = nextHour.hour();
          if (hour < schedule.startHour || hour > schedule.endHour) {
            return nextHour.hour(schedule.startHour).add(1, 'day');
          }
        }
        return nextHour;

      case 'everyNHours':
        const interval = schedule.interval;
        const startTime = schedule.startTime ?
          dayjs(schedule.startTime).tz(this.timezone) :
          dayjs(task.createdAt).tz(this.timezone);
        const hoursSinceStart = now.diff(startTime, 'hour');
        const nextInterval = Math.ceil(hoursSinceStart / interval) * interval;
        return startTime.add(nextInterval, 'hour');

      case 'daily':
        const [hour, minute] = schedule.time.split(':').map(Number);
        let nextDaily = now.hour(hour).minute(minute).second(0);
        if (nextDaily.isBefore(now)) {
          nextDaily = nextDaily.add(1, 'day');
        }
        // 检查工作日/周末过滤
        if (schedule.dayFilter === 'weekday') {
          while (nextDaily.day() === 0 || nextDaily.day() === 6) {
            nextDaily = nextDaily.add(1, 'day');
          }
        } else if (schedule.dayFilter === 'weekend') {
          while (nextDaily.day() !== 0 && nextDaily.day() !== 6) {
            nextDaily = nextDaily.add(1, 'day');
          }
        }
        return nextDaily;

      case 'weekly':
        const [wHour, wMinute] = schedule.time.split(':').map(Number);
        let nextWeekly = now.hour(wHour).minute(wMinute).second(0);
        const currentDay = now.day();
        const targetDays = schedule.days.sort((a, b) => a - b);

        // 找到下一个目标日期
        let targetDay = targetDays.find(d => d > currentDay ||
          (d === currentDay && nextWeekly.isAfter(now)));

        if (targetDay === undefined) {
          targetDay = targetDays[0];
          nextWeekly = nextWeekly.add(1, 'week');
        }

        return nextWeekly.day(targetDay);

      case 'monthly':
        const [mHour, mMinute] = schedule.time.split(':').map(Number);
        let nextMonthly = now.date(schedule.day).hour(mHour).minute(mMinute).second(0);

        if (nextMonthly.isBefore(now)) {
          nextMonthly = nextMonthly.add(1, 'month');
        }

        // 处理月末日期溢出
        if (schedule.rollover === 'clip') {
          const lastDay = nextMonthly.endOf('month').date();
          if (schedule.day > lastDay) {
            nextMonthly = nextMonthly.date(lastDay);
          }
        }

        return nextMonthly;

      case 'cron':
        // Cron 表达式由 node-cron 处理
        return dayjs().add(1, 'minute');

      default:
        logger.warn('Unknown schedule type', { type: schedule.type });
        return null;
    }
  }

  // 更新任务的下次执行时间
  async updateTaskNextPushAt(taskId, nextPushAt) {
    await fileStore.updateJson('tasks.json', (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.nextPushAt = nextPushAt;
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    }, []);
  }

  // 更新任务的最后推送时间
  async updateTaskLastPushAt(taskId) {
    await fileStore.updateJson('tasks.json', (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.lastPushAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    }, []);
  }

  // 禁用任务
  async disableTask(taskId) {
    await fileStore.updateJson('tasks.json', (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.enabled = false;
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    }, []);
  }

  // 重新加载所有任务
  async reload() {
    logger.info('Reloading scheduler');
    this.jobs.forEach((job, taskId) => {
      if (job.cronJob) {
        job.cronJob.stop();
      }
    });
    this.jobs.clear();
    await this.loadAllTasks();
  }

  // 获取调度器状态
  getStatus() {
    const jobs = [];
    this.jobs.forEach((job, taskId) => {
      jobs.push({
        taskId,
        title: job.task.title,
        nextPushAt: job.nextPushAt,
        retryCount: job.retryCount
      });
    });

    return {
      isRunning: this.isRunning,
      timezone: this.timezone,
      totalJobs: this.jobs.size,
      jobs
    };
  }
}

// 导出单例
module.exports = new Scheduler();