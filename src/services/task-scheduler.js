/**
 * 任务调度处理模块
 * 负责任务的调度、执行和时间计算
 * 行数限制：200行以内
 */

const cron = require('node-cron');
const dayjs = require('dayjs');
const logger = require('../utils/logger');
const TimeCalculator = require('./time-calculator');
const TaskExecutor = require('./task-executor');
const { SCHEDULER } = require('../config/constants');

class TaskScheduler {
  /**
   * 调度单个任务
   */
  async scheduleTask(task, timezone, onJobCreated) {
    try {
      if (!task.enabled) {
        return null;
      }

      const nextPushAt = this.calculateNextPushTime(task);

      if (!nextPushAt) {
        logger.warn('无法计算下次推送时间', { taskId: task.id });
        return null;
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
          if (onJobCreated) {
            await onJobCreated(task.id);
          }
        }, {
          scheduled: true,
          timezone
        });
        job.cronJob = cronJob;
      }

      logger.info('任务已调度', {
        taskId: task.id,
        nextPushAt,
        scheduleType: task.scheduleType
      });

      return job;
    } catch (error) {
      logger.error('任务调度失败', {
        taskId: task.id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 执行任务
   */
  async executeTask(task, onLastPushUpdate) {
    try {
      logger.info('开始执行任务', {
        taskId: task.id,
        title: task.title
      });

      // 使用TaskExecutor执行任务
      const execution = await TaskExecutor.prepareExecution(task);
      const results = await TaskExecutor.sendNotifications(execution);
      await TaskExecutor.handleResults(task, results, onLastPushUpdate);

      return { success: true, results };
    } catch (error) {
      logger.error('任务执行失败', {
        taskId: task.id,
        error: error.message
      });
      return { success: false, error };
    }
  }

  /**
   * 处理任务失败
   */
  handleTaskFailure(job, error, maxRetries, onRetry, onRemove) {
    const result = TaskExecutor.handleFailure(job, error, maxRetries);

    if (result.shouldRetry) {
      setTimeout(() => {
        if (onRetry) {
          onRetry(job.id);
        }
      }, result.delay);
    } else {
      if (onRemove) {
        onRemove(job.id);
      }
    }
  }

  /**
   * 计算下次推送时间 - 使用TimeCalculator
   */
  calculateNextPushTime(task) {
    // 兼容新旧数据格式
    const schedule = task.schedule || { type: task.scheduleType, value: task.scheduleValue };
    const scheduleType = schedule.type || task.scheduleType;

    switch (scheduleType) {
      case 'once':
        const datetime = schedule.datetime || task.scheduleValue;
        return new Date(datetime) > new Date()
          ? new Date(datetime)
          : null;

      case 'hourly':
        return TimeCalculator.calculateHourly(
          schedule.minute,
          schedule.startHour,
          schedule.endHour
        );

      case 'daily':
        const dailyTimes = schedule.times || (schedule.time ? [schedule.time] : []);
        return TimeCalculator.calculateDaily(dailyTimes);

      case 'weekly':
        return TimeCalculator.calculateWeekly(
          schedule.days || schedule.weekDays,
          schedule.time
        );

      case 'monthly':
        return TimeCalculator.calculateMonthly(
          schedule.day ? [schedule.day] : schedule.days,
          schedule.time
        );

      case 'monthlyInterval':
        // 计算每N个月的调度
        const { interval, day, time } = schedule;
        if (!interval || !day || !time) return null;

        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        const nextTime = new Date(now);

        // 设置到指定日期和时间
        nextTime.setDate(day);
        nextTime.setHours(hours, minutes, 0, 0);

        // 如果这个月的时间已经过了，移到下个间隔
        if (nextTime <= now) {
          nextTime.setMonth(nextTime.getMonth() + interval);
        }

        return nextTime;

      case 'interval':
        return TimeCalculator.calculateInterval(
          schedule.interval || task.scheduleValue?.interval,
          task.lastPushAt
        );

      case 'workdays':
        return TimeCalculator.calculateWorkdays(schedule.times || task.scheduleValue?.times);

      case 'weekend':
        return TimeCalculator.calculateWeekend(schedule.times || task.scheduleValue?.times);

      case 'cron':
        return TimeCalculator.calculateCron(schedule.expression || task.scheduleValue);

      case 'custom':
        return TimeCalculator.calculateCustom(schedule.dates || task.scheduleValue?.dates);

      default:
        logger.warn('未知的调度类型', {
          taskId: task.id,
          scheduleType
        });
        return null;
    }
  }

  /**
   * 检查是否需要执行任务
   */
  shouldExecuteTask(job, timezone) {
    const now = dayjs().tz(timezone);
    return job.nextPushAt && dayjs(job.nextPushAt).isBefore(now);
  }
}

module.exports = new TaskScheduler();