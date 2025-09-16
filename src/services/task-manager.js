/**
 * 任务管理模块
 * 负责任务的加载、更新和持久化
 * 行数限制：150行以内
 */

const fileStore = require('./file-store');
const logger = require('../utils/logger');
const { FILES } = require('../config/constants');

class TaskManager {
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

      return enabledTasks;
    } catch (error) {
      logger.error('Failed to load tasks', { error: error.message });
      return [];
    }
  }

  /**
   * 获取单个任务
   */
  async getTask(taskId) {
    try {
      const tasks = await fileStore.readJson(FILES.TASKS, []);
      return tasks.find(t => t.id === taskId);
    } catch (error) {
      logger.error('Failed to get task', { taskId, error: error.message });
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
   * 启用任务
   */
  async enableTask(taskId) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.enabled = true;
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    });
  }

  /**
   * 更新任务
   */
  async updateTask(taskId, updates) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        Object.assign(task, updates);
        task.updatedAt = new Date().toISOString();
      }
      return tasks;
    });
  }

  /**
   * 批量更新任务
   */
  async batchUpdateTasks(updateFn) {
    await fileStore.updateJson(FILES.TASKS, updateFn);
  }

  /**
   * 获取所有任务
   */
  async getAllTasks() {
    try {
      return await fileStore.readJson(FILES.TASKS, []);
    } catch (error) {
      logger.error('Failed to get all tasks', { error: error.message });
      return [];
    }
  }

  /**
   * 保存任务
   */
  async saveTask(task) {
    await fileStore.updateJson(FILES.TASKS, (tasks) => {
      const index = tasks.findIndex(t => t.id === task.id);
      if (index >= 0) {
        tasks[index] = task;
      } else {
        tasks.push(task);
      }
      return tasks;
    });
  }
}

module.exports = new TaskManager();