/**
 * 任务调度器 - 模块化重构版
 * 整合核心调度、任务管理和任务调度功能
 * 行数限制：300行以内
 */

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const SchedulerCore = require('./scheduler-core');
const TaskManager = require('./task-manager');
const TaskScheduler = require('./task-scheduler');
const logger = require('../utils/logger');
const { SCHEDULER } = require('../config/constants');

// 配置 dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

class Scheduler {
  constructor() {
    // 初始化核心调度器
    this.core = new SchedulerCore();
    // 绑定方法到实例
    this.checkTasks = this.checkTasks.bind(this);
    this.loadAllTasks = this.loadAllTasks.bind(this);
  }

  /**
   * 启动调度器
   */
  async start() {
    await this.core.start(this.loadAllTasks, this.checkTasks);
  }

  /**
   * 停止调度器
   */
  stop() {
    this.core.stop();
  }

  /**
   * 加载所有任务
   */
  async loadAllTasks() {
    try {
      const enabledTasks = await TaskManager.loadAllTasks();

      for (const task of enabledTasks) {
        await this.scheduleTask(task);
      }
    } catch (error) {
      logger.error('Failed to load all tasks', { error: error.message });
    }
  }

  /**
   * 检查需要执行的任务
   */
  async checkTasks() {
    const jobs = this.core.getAllJobs();

    for (const [taskId, job] of jobs) {
      if (TaskScheduler.shouldExecuteTask(job, this.core.getTimezone())) {
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

      const job = await TaskScheduler.scheduleTask(
        task,
        this.core.getTimezone(),
        async (taskId) => {
          await this.executeTask(taskId);
        }
      );

      if (job) {
        this.core.addJob(task.id, job);
        await TaskManager.updateTaskNextPushAt(task.id, job.nextPushAt);
      }
    } catch (error) {
      logger.error('Failed to schedule task', {
        taskId: task.id,
        error: error.message
      });
    }
  }

  /**
   * 移除任务
   */
  removeTask(taskId) {
    this.core.removeJob(taskId);
  }

  /**
   * 执行任务
   */
  async executeTask(taskId) {
    const job = this.core.getJob(taskId);
    if (!job) {
      logger.warn('任务不存在', { taskId });
      return;
    }

    try {
      const result = await TaskScheduler.executeTask(
        job.task,
        async (id) => {
          await TaskManager.updateTaskLastPushAt(id);
        }
      );

      if (result.success) {
        // 计算并更新下次执行时间
        if (job.task.scheduleType !== 'once') {
          const nextPushAt = TaskScheduler.calculateNextPushTime(job.task);
          if (nextPushAt) {
            job.nextPushAt = nextPushAt;
            await TaskManager.updateTaskNextPushAt(taskId, nextPushAt);
          }
        } else {
          // 单次任务执行后禁用
          await TaskManager.disableTask(taskId);
          this.removeTask(taskId);
        }
      } else {
        this.handleTaskFailure(job, result.error);
      }
    } catch (error) {
      this.handleTaskFailure(job, error);
    }
  }

  /**
   * 处理任务失败
   */
  handleTaskFailure(job, error) {
    TaskScheduler.handleTaskFailure(
      job,
      error,
      SCHEDULER.MAX_RETRIES,
      (taskId) => this.executeTask(taskId),
      (taskId) => this.removeTask(taskId)
    );
  }

  /**
   * 重新加载任务
   */
  async reload() {
    logger.info('Reloading scheduler');

    this.core.clearJobs();
    await this.loadAllTasks();
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return this.core.getStatus();
  }

  // 对外接口 - 委托给各模块
  calculateNextPushTime(task) {
    return TaskScheduler.calculateNextPushTime(task);
  }

  async updateTaskNextPushAt(taskId, nextPushAt) {
    await TaskManager.updateTaskNextPushAt(taskId, nextPushAt);
  }

  async updateTaskLastPushAt(taskId) {
    await TaskManager.updateTaskLastPushAt(taskId);
  }

  async disableTask(taskId) {
    await TaskManager.disableTask(taskId);
    this.removeTask(taskId);
  }

  async enableTask(taskId) {
    await TaskManager.enableTask(taskId);
    const task = await TaskManager.getTask(taskId);
    if (task) await this.scheduleTask(task);
  }

  async getTask(taskId) {
    return await TaskManager.getTask(taskId);
  }

  async updateTask(taskId, updates) {
    await TaskManager.updateTask(taskId, updates);
    const task = await TaskManager.getTask(taskId);
    if (task) {
      this.removeTask(taskId);
      await this.scheduleTask(task);
    }
  }

  async getAllTasks() {
    return await TaskManager.getAllTasks();
  }

  async executeTaskNow(taskId) {
    const task = await TaskManager.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    return await TaskScheduler.executeTask(
      task,
      async (id) => await TaskManager.updateTaskLastPushAt(id)
    );
  }

  async batchUpdateTasks(updateFn) {
    await TaskManager.batchUpdateTasks(updateFn);
    await this.reload();
  }

  getJob(taskId) { return this.core.getJob(taskId); }
  getAllJobs() { return this.core.getAllJobs(); }
  get isRunning() { return this.core.getIsRunning(); }
  get timezone() { return this.core.getTimezone(); }
  get jobs() { return this.core.getAllJobs(); }
}

module.exports = new Scheduler();