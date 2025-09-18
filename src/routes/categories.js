const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fileStore = require('../services/file-store');
const { validate } = require('../middleware/validator');
const { NotFoundError, ConflictError, ForbiddenError } = require('../middleware/error');
const logger = require('../utils/logger');

const router = express.Router();

// 获取分类列表
router.get('/', async (req, res, next) => {
  try {
    let categories = await fileStore.readJson('categories.json', []);
    const tasks = await fileStore.readJson('tasks.json', []);

    // 计算每个分类的任务数
    categories = categories.map(category => {
      const count = tasks.filter(t => t.categoryId === category.id).length;
      return { ...category, count };
    });

    // 按排序顺序排列
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// 创建分类
router.post('/', validate('category'), async (req, res, next) => {
  try {
    const { name, color, icon, sortOrder } = req.body;

    // 检查名称是否重复
    const categories = await fileStore.readJson('categories.json', []);
    const exists = categories.some(c => c.name === name);

    if (exists) {
      throw new ConflictError('分类名称已存在');
    }

    const category = {
      id: uuidv4(),
      name,
      color: color || '#4F46E5',
      icon: icon || '📁',
      sortOrder: sortOrder || categories.length,
      createdAt: new Date().toISOString()
    };

    await fileStore.updateJson('categories.json', (cats) => {
      cats.push(category);
      return cats;
    }, []);

    logger.info('Category created', { categoryId: category.id, name: category.name });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// 更新分类
router.put('/:id', validate('categoryUpdate'), async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    const { name, color, icon, sortOrder } = req.body;
    let updatedCategory = null;

    await fileStore.updateJson('categories.json', (categories) => {
      const category = categories.find(c => c.id === categoryId);
      if (!category) {
        throw new NotFoundError('分类不存在');
      }

      // 如果修改名称，检查是否重复
      if (name && name !== category.name) {
        const exists = categories.some(c => c.name === name && c.id !== categoryId);
        if (exists) {
          throw new ConflictError('分类名称已存在');
        }
        category.name = name;
      }

      if (color !== undefined) category.color = color;
      if (icon !== undefined) category.icon = icon;
      if (sortOrder !== undefined) category.sortOrder = sortOrder;

      updatedCategory = category;
      return categories;
    }, []);

    logger.info('Category updated', { categoryId, name: updatedCategory.name });
    res.json(updatedCategory);
  } catch (error) {
    next(error);
  }
});

// 删除分类
router.delete('/:id', async (req, res, next) => {
  try {
    const categoryId = req.params.id;

    // 不允许删除默认分类
    if (categoryId === 'default') {
      throw new ForbiddenError('不能删除默认分类');
    }

    // 检查是否有任务使用此分类
    const tasks = await fileStore.readJson('tasks.json', []);
    const hasRelatedTasks = tasks.some(t => t.categoryId === categoryId);

    if (hasRelatedTasks) {
      // 将相关任务移动到默认分类
      await fileStore.updateJson('tasks.json', (tasks) => {
        tasks.forEach(task => {
          if (task.categoryId === categoryId) {
            task.categoryId = 'default';
            task.updatedAt = new Date().toISOString();
          }
        });
        return tasks;
      }, []);
    }

    await fileStore.updateJson('categories.json', (categories) => {
      const index = categories.findIndex(c => c.id === categoryId);
      if (index === -1) {
        throw new NotFoundError('分类不存在');
      }

      categories.splice(index, 1);
      return categories;
    }, []);

    logger.info('Category deleted', { categoryId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;