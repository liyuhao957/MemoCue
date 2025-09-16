// 任务管理模块
window.TaskManager = {
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
      schedule: { ...task.schedule },
      priority: task.priority || 0,
      sound: task.sound || 'default'
    };
    app.openModal('task');
  },

  // 保存任务
  async saveTask(app) {
    try {
      const data = { ...app.taskForm };

      // 清理调度配置
      const schedule = {};
      switch (data.schedule.type) {
        case 'once':
          schedule.type = 'once';
          schedule.datetime = data.schedule.datetime;
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
          break;
        case 'weekly':
          schedule.type = 'weekly';
          schedule.time = data.schedule.time;
          schedule.days = data.schedule.days.map(Number);
          break;
        case 'monthly':
          schedule.type = 'monthly';
          schedule.time = data.schedule.time;
          schedule.day = Number(data.schedule.day);
          break;
        case 'monthlyInterval':
          schedule.type = 'monthlyInterval';
          schedule.time = data.schedule.time;
          schedule.day = Number(data.schedule.day);
          schedule.interval = Number(data.schedule.interval) || 1;
          if (data.schedule.firstDate) {
            schedule.firstDate = data.schedule.firstDate;
          }
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

      await app.loadTasks();
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
        firstDate: ''
      },
      priority: 0,
      sound: 'default'
    };
  }
};