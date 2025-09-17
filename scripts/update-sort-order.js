#!/usr/bin/env node

/**
 * 更新现有任务的sortOrder字段
 * 为已存在但没有sortOrder的任务分配排序值
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

async function updateSortOrder() {
  try {
    console.log('开始更新任务排序字段...');
    
    // 读取现有任务
    let tasks = [];
    if (fs.existsSync(TASKS_FILE)) {
      const content = fs.readFileSync(TASKS_FILE, 'utf8');
      tasks = JSON.parse(content);
    }

    console.log(`找到 ${tasks.length} 个任务`);

    // 统计需要更新的任务
    const tasksNeedUpdate = tasks.filter(task => task.sortOrder === undefined);
    console.log(`需要更新排序的任务: ${tasksNeedUpdate.length} 个`);

    if (tasksNeedUpdate.length === 0) {
      console.log('所有任务都已有排序字段，无需更新');
      return;
    }

    // 按创建时间排序，然后分配sortOrder
    tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    tasks.forEach((task, index) => {
      if (task.sortOrder === undefined) {
        task.sortOrder = index;
        task.updatedAt = new Date().toISOString();
        console.log(`更新任务 "${task.title}" 的排序为: ${index}`);
      }
    });

    // 保存更新后的任务
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
    
    console.log('✅ 任务排序字段更新完成');
    console.log(`📄 已更新文件: ${TASKS_FILE}`);
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateSortOrder();
}

module.exports = updateSortOrder;
