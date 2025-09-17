// 数据加载模块
window.DataLoader = {
  // 加载所有数据
  async loadData(app) {
    try {
      app.isLoading = true;

      // 第一批：加载基础数据（无依赖）
      await Promise.all([
        this.loadTasks(app),
        this.loadCategories(app),
        this.loadDevices(app),
        this.loadExecutionLogs(app)
      ]);

      // 第二批：加载需要依赖任务列表的数据
      await this.loadTaskExecutions(app);

      // 计算今日统计
      this.calculateTodayStats(app);

      app.isLoading = false;
      console.log('数据加载完成');
    } catch (error) {
      app.isLoading = false;
      console.error('数据加载失败:', error);
      app.showMessage('error', '错误', '数据加载失败，请刷新页面');
    }
  },

  // 加载任务列表
  async loadTasks(app) {
    try {
      const tasks = await app.api('/api/tasks');
      // 只更新数组内容，保持引用不变
      app.tasks.length = 0;
      app.tasks.push(...(tasks.data || []));
      console.log(`已加载 ${app.tasks.length} 个任务`);
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  },

  // 加载分类列表
  async loadCategories(app) {
    try {
      const categories = await app.api('/api/categories');
      // 只更新数组内容，保持引用不变
      app.categories.length = 0;
      app.categories.push(...categories);

      // 确保有默认分类
      if (!app.categories.find(c => c.id === 'default')) {
        app.categories.unshift({ id: 'default', name: '默认', icon: '📌', color: '#3b82f6' });
      }
      console.log(`已加载 ${app.categories.length} 个分类`);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  },

  // 加载设备列表
  async loadDevices(app) {
    try {
      const devices = await app.api('/api/devices');
      app.devices = devices;
      console.log(`已加载 ${app.devices.length} 个设备`);
    } catch (error) {
      console.error('加载设备失败:', error);
    }
  },

  // 加载任务执行记录（用于任务列表显示最后执行状态）
  async loadTaskExecutions(app) {
    try {
      // 如果没有任务，跳过执行记录加载
      if (!app.tasks || app.tasks.length === 0) {
        console.log('暂无任务，跳过执行记录加载');
        return;
      }

      // 为每个任务获取最近的执行记录
      const executions = await app.api('/api/logs/recent');

      // 创建任务ID到执行记录的映射
      const executionMap = {};
      executions.forEach(log => {
        if (!executionMap[log.taskId] || new Date(log.timestamp) > new Date(executionMap[log.taskId].timestamp)) {
          executionMap[log.taskId] = log;
        }
      });

      // 更新任务的最后执行状态
      app.tasks.forEach(task => {
        const lastExecution = executionMap[task.id];
        if (lastExecution) {
          task.lastExecutionStatus = lastExecution.status;
          task.lastExecutionTime = lastExecution.timestamp;
          task.lastExecutionError = lastExecution.error;
        }
      });

      console.log(`已加载 ${executions.length} 条执行记录`);
    } catch (error) {
      console.error('加载执行记录失败:', error);
    }
  },

  // 加载执行日志（用于发送记录面板）
  async loadExecutionLogs(app) {
    try {
      const logs = await app.api('/api/logs?limit=100');

      // 只更新数组内容，保持引用不变
      app.executionLogs.length = 0;
      app.executionLogs.push(...logs);

      // 计算统计数据
      const stats = await app.api('/api/logs/stats');
      app.executionStats.total = stats.total || 0;
      app.executionStats.success = stats.success || 0;
      app.executionStats.failed = stats.failed || 0;
      app.executionStats.today = stats.today || 0;

      console.log(`已加载 ${app.executionLogs.length} 条执行日志`);
    } catch (error) {
      console.error('加载执行日志失败:', error);
      // 即使失败也要初始化空数组
      app.executionLogs = [];
      app.executionStats = { total: 0, success: 0, failed: 0, today: 0 };
    }
  },

  // 计算今日统计
  calculateTodayStats(app) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 计算本周开始时间（周一）
    const weekStart = new Date(today);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    // 今日执行日志
    const todayLogs = app.executionLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= today && logDate < tomorrow;
    });

    // 本周执行日志
    const weekLogs = app.executionLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= weekStart && logDate < tomorrow;
    });

    // 成功推送数（今日）- 使用正确的属性名
    app.todayStats.success = todayLogs.filter(log => log.status === 'success').length;

    // 失败推送数（今日）- 使用正确的属性名
    app.todayStats.failed = todayLogs.filter(log => log.status === 'failed').length;

    // 成功率（今日）
    const total = app.todayStats.success + app.todayStats.failed;
    app.todayStats.successRate = total > 0 ? Math.round((app.todayStats.success / total) * 100) : 0;

    // 待执行任务数（今日剩余）
    app.todayStats.pending = app.tasks.filter(task => {
      if (!task.enabled) return false;
      // 简化逻辑：检查是否有今日未执行的任务
      const hasExecutedToday = todayLogs.some(log => log.taskId === task.id);
      return !hasExecutedToday;
    }).length;

    // 本周推送总数
    app.todayStats.weekTotal = weekLogs.length;

    // 平均耗时（毫秒）
    const successLogs = todayLogs.filter(log => log.status === 'success' && log.duration);
    if (successLogs.length > 0) {
      const totalDuration = successLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
      app.todayStats.avgTime = Math.round(totalDuration / successLogs.length);
    } else {
      app.todayStats.avgTime = 0;
    }

    console.log('今日统计:', app.todayStats);
  },

  // 显示所有日志（用于执行记录的"查看全部"）
  showAllLogs(app) {
    app.logStatusFilter = 'all';
    app.showAllLogsButton = false;
  }
};