// 任务管理模块
window.TaskManager = {
  // 辅助函数：应用重复发送配置
  applyRepeatConfig(schedule, data) {
    if (data.schedule.enableRepeat) {
      schedule.enableRepeat = true;
      schedule.repeatCount = Number(data.schedule.repeatCount) || 1;
      schedule.repeatInterval = Number(data.schedule.repeatInterval) || 5;
    }
  },

  // 切换任务状态
  async toggleTask(taskId, app) {
    try {
      await app.api(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' });
      const task = app.tasks.find(t => t.id === taskId);
      if (task) {
        task.enabled = !task.enabled;
      }
      app.showMessage('success', '成功', '任务状态已更新');
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 编辑任务
  editTask(task, app) {
    app.editingTask = task;
    app.taskForm = {
      title: task.title,
      content: task.content || '',
      deviceId: task.deviceId,
      categoryId: task.categoryId,
      schedule: {
        ...task.schedule,
        // 深拷贝days数组，避免引用污染
        days: task.schedule.days ? [...task.schedule.days] : [],
        // 确保重复发送相关字段存在
        enableRepeat: task.schedule.enableRepeat || false,
        repeatCount: task.schedule.repeatCount || 1,
        repeatInterval: task.schedule.repeatInterval || 5
      },
      priority: task.priority || 0,
      sound: task.sound || 'default',
      url: task.url || '',
      // 兼容旧数据：如果没有 barkSound，使用 sound 字段作为默认值
      barkSound: task.barkSound || task.sound || 'default',
      barkUrl: task.barkUrl || ''
    };
    app.openModal('task');
  },

  // 保存任务
  async saveTask(app) {
    try {
      const data = { ...app.taskForm };

      // 如果不是飞书设备，重置飞书特有字段
      if (!app.isFeishuDevice()) {
        data.priority = 0;  // 默认优先级
        data.url = '';      // 清空URL
      }

      // 如果不是 Bark 设备，重置 Bark 特有字段
      if (!app.isBarkDevice()) {
        data.barkSound = 'default';  // 默认声音
        data.barkUrl = '';           // 清空URL
      }

      // 清理调度配置
      const schedule = {};
      switch (data.schedule.type) {
        case 'once':
          schedule.type = 'once';
          schedule.datetime = data.schedule.datetime;
          // 添加重复发送配置
          this.applyRepeatConfig(schedule, data);
          break;
        case 'hourly':
          schedule.type = 'hourly';
          schedule.minute = Number(data.schedule.minute) || 0;
          if (data.schedule.startHour !== '' && data.schedule.startHour !== null) {
            schedule.startHour = Number(data.schedule.startHour);
          }
          if (data.schedule.endHour !== '' && data.schedule.endHour !== null) {
            schedule.endHour = Number(data.schedule.endHour);
          }
          break;
        case 'daily':
          schedule.type = 'daily';
          schedule.time = data.schedule.time;
          // 添加重复发送配置
          this.applyRepeatConfig(schedule, data);
          break;
        case 'weekly':
          schedule.type = 'weekly';
          schedule.time = data.schedule.time;
          schedule.days = data.schedule.days.map(Number);
          // 添加重复发送配置
          this.applyRepeatConfig(schedule, data);
          break;
        case 'monthly':
          schedule.type = 'monthly';
          schedule.time = data.schedule.time;
          schedule.day = Number(data.schedule.day);
          // 添加重复发送配置
          this.applyRepeatConfig(schedule, data);
          break;
        case 'monthlyInterval':
          schedule.type = 'monthlyInterval';
          schedule.time = data.schedule.time;
          schedule.day = Number(data.schedule.day);
          schedule.interval = Number(data.schedule.interval) || 1;
          if (data.schedule.firstDate) {
            schedule.firstDate = data.schedule.firstDate;
          }
          // 添加重复发送配置
          this.applyRepeatConfig(schedule, data);
          break;
        case 'cron':
          schedule.type = 'cron';
          schedule.expression = data.schedule.expression;
          break;
      }
      data.schedule = schedule;

      if (app.editingTask) {
        // 更新任务
        await app.api(`/api/tasks/${app.editingTask.id}`, {
          method: 'PUT',
          body: data
        });
        app.showMessage('success', '成功', '任务已更新');
      } else {
        // 创建任务
        await app.api('/api/tasks', {
          method: 'POST',
          body: data
        });
        app.showMessage('success', '成功', '任务已创建');
      }

      await app.loadTasks();  // 这会同时刷新任务执行记录
      await app.loadExecutionLogs();  // 刷新发送记录面板
      app.closeModal();
      app.resetTaskForm();
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 删除任务
  async deleteTask(taskId, app) {
    if (!confirm('确定删除这个提醒吗？')) return;

    try {
      await app.api(`/api/tasks/${taskId}`, { method: 'DELETE' });
      app.tasks = app.tasks.filter(t => t.id !== taskId);
      app.showMessage('success', '成功', '任务已删除');
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 测试推送
  async testPush(task, app) {
    try {
      await app.api(`/api/push/${task.id}`, { method: 'POST' });
      app.showMessage('success', '成功', '推送已发送');
      // 刷新执行记录和日志
      await app.loadTaskExecutions();
      await app.loadExecutionLogs();
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 重置任务表单
  resetTaskForm(app) {
    app.editingTask = null;
    app.taskForm = {
      title: '',
      content: '',
      deviceId: '',
      categoryId: 'default',
      schedule: {
        type: 'daily',
        time: '09:00',
        datetime: '',
        days: [],
        day: 15,
        expression: '',
        minute: 0,
        startHour: '',
        endHour: '',
        interval: 1,
        firstDate: '',
        // 重复发送相关字段
        enableRepeat: false,
        repeatCount: 1,
        repeatInterval: 5
      },
      priority: 0,
      sound: 'default',
      url: '',
      barkSound: 'default',
      barkUrl: ''
    };
  }
};