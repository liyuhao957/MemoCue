const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fileStore = require('../services/file-store');
const scheduler = require('../services/scheduler');
const logStore = require('../services/log-store');
const { validate } = require('../middleware/validator');
const { NotFoundError } = require('../middleware/error');
const logger = require('../utils/logger');

const router = express.Router();

// 获取任务列表
router.get('/', validate('queryParams'), async (req, res, next) => {
  try {
    const { category, enabled, device, limit = 50, offset = 0 } = req.query;

    let tasks = await fileStore.readJson('tasks.json', []);

    // 过滤
    if (category) {
      tasks = tasks.filter(t => t.categoryId === category);
    }
    if (enabled !== undefined) {
      tasks = tasks.filter(t => t.enabled === enabled);
    }
    if (device) {
      tasks = tasks.filter(t => t.deviceId === device);
    }

    // 排序（最新的在前）
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 分页
    const total = tasks.length;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    res.json({
      total,
      limit,
      offset,
      data: paginatedTasks
    });
  } catch (error) {
    next(error);
  }
});

// 创建任务
router.post('/', validate('task'), async (req, res, next) => {
  try {
    // 获取当前最大的sortOrder
    const tasks = await fileStore.readJson('tasks.json', []);
    const maxSortOrder = Math.max(...tasks.map(t => t.sortOrder || 0), -1);

    const task = {
      id: uuidv4(),
      ...req.body,
      enabled: req.body.enabled !== false,
      sortOrder: maxSortOrder + 1, // 新任务排在最后
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 保存任务
    await fileStore.updateJson('tasks.json', (tasks) => {
      tasks.push(task);
      return tasks;
    }, []);

    // 如果任务启用，添加到调度器
    if (task.enabled) {
      await scheduler.scheduleTask(task);
    }

    logger.info('Task created', { taskId: task.id, title: task.title });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// 获取任务详情
router.get('/:id', async (req, res, next) => {
  try {
    const tasks = await fileStore.readJson('tasks.json', []);
    const task = tasks.find(t => t.id === req.params.id);

    if (!task) {
      throw new NotFoundError('任务不存在');
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// 更新任务
router.put('/:id', validate('taskUpdate'), async (req, res, next) => {
  try {
    const taskId = req.params.id;
    let updatedTask = null;

    await fileStore.updateJson('tasks.json', (tasks) => {
      const index = tasks.findIndex(t => t.id === taskId);
      if (index === -1) {
        throw new NotFoundError('任务不存在');
      }

      updatedTask = {
        ...tasks[index],
        ...req.body,
        id: taskId, // 防止修改ID
        updatedAt: new Date().toISOString()
      };

      tasks[index] = updatedTask;
      return tasks;
    }, []);

    // 更新调度器
    if (updatedTask.enabled) {
      await scheduler.scheduleTask(updatedTask);
    } else {
      scheduler.removeTask(taskId);
    }

    logger.info('Task updated', { taskId, title: updatedTask.title });
    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
});

// 删除任务
router.delete('/:id', async (req, res, next) => {
  try {
    const taskId = req.params.id;
    let deleted = false;

    await fileStore.updateJson('tasks.json', (tasks) => {
      const index = tasks.findIndex(t => t.id === taskId);
      if (index === -1) {
        throw new NotFoundError('任务不存在');
      }

      tasks.splice(index, 1);
      deleted = true;
      return tasks;
    }, []);

    // 从调度器移除
    scheduler.removeTask(taskId);

    logger.info('Task deleted', { taskId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// 启用/禁用任务
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const taskId = req.params.id;
    let updatedTask = null;

    await fileStore.updateJson('tasks.json', (tasks) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new NotFoundError('任务不存在');
      }

      task.enabled = !task.enabled;
      task.updatedAt = new Date().toISOString();
      updatedTask = task;
      return tasks;
    }, []);

    // 更新调度器
    if (updatedTask.enabled) {
      await scheduler.scheduleTask(updatedTask);
    } else {
      scheduler.removeTask(taskId);
    }

    logger.info('Task toggled', { taskId, enabled: updatedTask.enabled });
    res.json({ enabled: updatedTask.enabled });
  } catch (error) {
    next(error);
  }
});

// 获取任务的最近执行记录
router.get('/:id/last-execution', async (req, res, next) => {
  try {
    const { id: taskId } = req.params;
    const lastExecution = await logStore.getLastExecutionForTask(taskId);

    res.json(lastExecution);
  } catch (error) {
    next(error);
  }
});

// 获取多个任务的最近执行记录
router.post('/last-executions', async (req, res, next) => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds must be an array' });
    }

    const executionMap = await logStore.getLastExecutionsForTasks(taskIds);
    const executions = {};

    executionMap.forEach((value, key) => {
      executions[key] = value;
    });

    res.json(executions);
  } catch (error) {
    next(error);
  }
});

// 重新排序任务
router.post('/reorder', async (req, res, next) => {
  try {
    const { draggedTaskId, targetTaskId } = req.body;

    if (!draggedTaskId || !targetTaskId) {
      return res.status(400).json({ error: '缺少必要的参数' });
    }

    // 如果是同一个任务，直接返回
    if (draggedTaskId === targetTaskId) {
      return res.json({ success: true });
    }

    await fileStore.updateJson('tasks.json', (tasks) => {
      // 首先对任务进行排序
      const sortedTasks = [...tasks].sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        if (a.sortOrder !== undefined && b.sortOrder === undefined) {
          return -1;
        }
        if (a.sortOrder === undefined && b.sortOrder !== undefined) {
          return 1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // 找到被拖拽任务和目标任务在排序数组中的索引
      const draggedIndex = sortedTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = sortedTasks.findIndex(t => t.id === targetTaskId);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error('任务不存在');
      }

      // 从数组中移除被拖拽的任务
      const [draggedTask] = sortedTasks.splice(draggedIndex, 1);

      // 计算新的插入位置
      // 向下拖拽时，移除元素后目标左移，但我们要插入到原目标位置的后面
      // 所以向下时不需要-1，直接使用 targetIndex
      const insertIndex = targetIndex;

      // 将被拖拽的任务插入到新位置
      sortedTasks.splice(insertIndex, 0, draggedTask);

      // 重新分配所有任务的sortOrder
      sortedTasks.forEach((task, index) => {
        const originalTask = tasks.find(t => t.id === task.id);
        if (originalTask) {
          originalTask.sortOrder = index;
          // 只更新被移动任务的updatedAt时间
          if (originalTask.id === draggedTaskId) {
            originalTask.updatedAt = new Date().toISOString();
          }
        }
      });

      return tasks;
    }, []);

    logger.info('Tasks reordered', { draggedTaskId, targetTaskId });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 批量操作
router.post('/batch', validate('batchOperation'), async (req, res, next) => {
  try {
    const { ids, operation } = req.body;
    const results = [];

    await fileStore.updateJson('tasks.json', (tasks) => {
      for (const id of ids) {
        const task = tasks.find(t => t.id === id);
        if (!task) {
          results.push({ id, success: false, error: '任务不存在' });
          continue;
        }

        switch (operation) {
          case 'enable':
            task.enabled = true;
            scheduler.scheduleTask(task);
            break;
          case 'disable':
            task.enabled = false;
            scheduler.removeTask(id);
            break;
          case 'delete':
            const index = tasks.indexOf(task);
            tasks.splice(index, 1);
            scheduler.removeTask(id);
            break;
        }

        task.updatedAt = new Date().toISOString();
        results.push({ id, success: true });
      }
      return tasks;
    }, []);

    logger.info('Batch operation completed', { operation, count: ids.length });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

module.exports = router;