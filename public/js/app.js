// 配置 dayjs
dayjs.locale('zh-cn');

// Alpine.js 应用 - 模块化重构版
function memoCueApp() {
  return {
    // 状态数据
    tasks: [],
    categories: [],
    devices: [],
    executionLogs: [],
    todayStats: {
      success: 0,
      failed: 0,
      successRate: 0,
      pending: 0,
      weekTotal: 0,
      avgTime: 0
    },
    executionStats: {
      total: 0,
      success: 0,
      failed: 0
    },
    logsFilter: 'all',
    currentCategory: 'all',
    searchQuery: '',
    message: null,

    // 拖拽状态
    dragging: null,
    dragOver: null,
    draggedTask: null,
    showDragTip: false,
    dragTipDismissed: false,

    // 模态框状态
    activeModal: null, // 'task' | 'device' | 'category' | null

    // 编辑状态
    editingTask: null,
    editingCategory: null,
    editingDevice: null,
    savingDevice: false,

    // 表单数据
    taskForm: {
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
        firstDate: '' // 简化：首次执行的完整日期
      },
      priority: 0,
      sound: 'default'
    },

    deviceForm: {
      name: '',
      providerType: 'bark',
      server: 'https://api.day.app',
      key: '',
      webhookUrl: '',
      secret: '',
      messageType: 'auto'
    },

    categoryForm: {
      name: '',
      icon: '📁',
      color: '#4F46E5'
    },

    emojiPresets: CategoryManager.emojiPresets,

    // 初始化
    async init() {
      await this.loadData();

      // 初始化实时通信（如果可用）
      if (typeof RealtimeManager !== 'undefined') {
        RealtimeManager.initialize(this);
        console.log('实时推送已启用');
      }

      // 保留定时刷新作为降级方案
      setInterval(() => this.loadTasks(), 30000);
      this.activeModal = null;

      // 检查是否需要显示拖拽提示
      this.checkDragTip();
    },

    // 委托给 DataLoader 的方法
    async loadData() {
      return DataLoader.loadData(this);
    },

    // 加载任务列表
    async loadTasks() {
      return DataLoader.loadTasks(this);
    },

    // 加载分类列表
    async loadCategories() {
      return DataLoader.loadCategories(this);
    },

    // 加载设备列表
    async loadDevices() {
      return DataLoader.loadDevices(this);
    },

    // 加载任务执行记录
    async loadTaskExecutions() {
      return DataLoader.loadTaskExecutions(this);
    },

    // 加载执行日志
    async loadExecutionLogs() {
      return DataLoader.loadExecutionLogs(this);
    },

    // 计算今日统计
    calculateTodayStats() {
      return DataLoader.calculateTodayStats(this);
    },

    // 显示所有日志
    showAllLogs() {
      return DataLoader.showAllLogs(this);
      // 或者跳转到专门的日志页面
      this.showMessage('info', '功能开发中', '完整日志查看功能即将推出');
    },

    // API 请求封装
    async api(url, options = {}) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `请求失败: ${response.status}`);
        }

        // 处理 204 No Content
        if (response.status === 204) {
          return null;
        }

        return await response.json();
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    },

    // 获取过滤后的任务
    get filteredTasks() {
      let filtered = this.tasks;

      // 分类过滤
      if (this.currentCategory !== 'all') {
        filtered = filtered.filter(t => t.categoryId === this.currentCategory);
      }

      // 搜索过滤
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(t =>
          t.title.toLowerCase().includes(query) ||
          (t.content && t.content.toLowerCase().includes(query))
        );
      }

      return filtered;
    },

    // 获取排序后的过滤任务
    get sortedFilteredTasks() {
      // 先获取过滤后的任务
      const filtered = this.filteredTasks;
      
      // 按sortOrder排序，如果没有sortOrder则按创建时间排序
      return filtered.sort((a, b) => {
        // 如果两个任务都有sortOrder，按sortOrder排序
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        // 如果只有一个有sortOrder，有sortOrder的排在前面
        if (a.sortOrder !== undefined && b.sortOrder === undefined) {
          return -1;
        }
        if (a.sortOrder === undefined && b.sortOrder !== undefined) {
          return 1;
        }
        // 如果都没有sortOrder，按创建时间倒序
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    },

    // ===== 任务管理方法（调用模块） =====
    async toggleTask(taskId) {
      await TaskManager.toggleTask(taskId, this);
    },

    toggleWeekday(dayIndex) {
      // 确保days数组存在
      if (!this.taskForm.schedule.days) {
        this.taskForm.schedule.days = [];
      }

      // 切换选中状态
      const index = this.taskForm.schedule.days.indexOf(dayIndex);
      if (index > -1) {
        this.taskForm.schedule.days.splice(index, 1);
      } else {
        this.taskForm.schedule.days.push(dayIndex);
      }
    },

    editTask(task) {
      TaskManager.editTask(task, this);
    },

    async saveTask() {
      await TaskManager.saveTask(this);
    },

    async deleteTask(taskId) {
      await TaskManager.deleteTask(taskId, this);
    },

    async testPush(task) {
      await TaskManager.testPush(task, this);
    },

    // 获取当前选中设备的类型
    getSelectedDeviceType() {
      if (!this.taskForm.deviceId) return null;
      const device = this.devices.find(d => d.id === this.taskForm.deviceId);
      return device ? device.providerType : null;
    },

    // 判断当前选中的是否为飞书设备
    isFeishuDevice() {
      return this.getSelectedDeviceType() === 'feishu';
    },

    // 判断当前选中的是否为 Bark 设备
    isBarkDevice() {
      return this.getSelectedDeviceType() === 'bark';
    },

    // 判断任务是否使用飞书设备
    isTaskUsingFeishu(task) {
      const device = this.devices.find(d => d.id === task.deviceId);
      return device ? device.providerType === 'feishu' : false;
    },

    // 判断任务是否使用 Bark 设备
    isTaskUsingBark(task) {
      const device = this.devices.find(d => d.id === task.deviceId);
      return device ? device.providerType === 'bark' : false;
    },

    // ===== 设备相关辅助方法 =====
    getDeviceName(task) {
      return UIUtils.getDeviceName(this.devices, task);
    },

    getDeviceIcon(task) {
      return UIUtils.getDeviceIcon(this.devices, task);
    },

    // ===== 拖拽相关方法 =====
    startDrag(task, event) {
      this.dragging = task.id;
      this.draggedTask = task;
      
      // 设置拖拽数据
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', task.id);
      
      // 延迟添加拖拽样式，避免影响拖拽图像
      setTimeout(() => {
        this.dragging = task.id;
      }, 0);
    },

    endDrag(event) {
      // 清理拖拽状态
      this.dragging = null;
      this.dragOver = null;
      this.draggedTask = null;
    },

    async handleDrop(targetTask, event) {
      event.preventDefault();
      
      const draggedTaskId = event.dataTransfer.getData('text/plain');
      const draggedTask = this.draggedTask;
      
      // 清理拖拽状态
      this.dragging = null;
      this.dragOver = null;
      
      // 如果拖拽到自己身上，不做任何操作
      if (!draggedTask || draggedTask.id === targetTask.id) {
        this.draggedTask = null;
        return;
      }

      try {
        // 调用重新排序方法
        await this.reorderTasks(draggedTask.id, targetTask.id);
        this.showMessage('success', '成功', '任务顺序已更新');
      } catch (error) {
        console.error('重新排序失败:', error);
        this.showMessage('error', '失败', '更新任务顺序失败: ' + error.message);
      } finally {
        this.draggedTask = null;
      }
    },

    async reorderTasks(draggedTaskId, targetTaskId) {
      try {
        // 发送重新排序请求到后端
        await this.api(`/api/tasks/reorder`, {
          method: 'POST',
          body: {
            draggedTaskId,
            targetTaskId
          }
        });

        // 重新加载任务列表以获取最新的排序
        await this.loadTasks();
        
        // 首次拖拽成功后隐藏提示
        if (this.showDragTip) {
          this.dismissDragTip();
        }
      } catch (error) {
        throw error;
      }
    },

    // 检查是否需要显示拖拽提示
    checkDragTip() {
      const dismissed = localStorage.getItem('dragTipDismissed');
      if (!dismissed && this.tasks.length >= 2) {
        setTimeout(() => {
          this.showDragTip = true;
        }, 2000); // 2秒后显示提示
      }
    },

    // 关闭拖拽提示
    dismissDragTip() {
      this.showDragTip = false;
      this.dragTipDismissed = true;
      localStorage.setItem('dragTipDismissed', 'true');
    },

    // ===== 设备管理方法（调用模块） =====
    // 保存设备（新增或更新）
    async saveDevice() {
      await DeviceManager.saveDevice(this);
    },

    // 添加设备（兼容旧代码）
    async addDevice() {
      await DeviceManager.addDevice(this);
    },

    // 编辑设备
    editDevice(device) {
      DeviceManager.editDevice(device, this);
    },

    // 取消编辑设备
    cancelEditDevice() {
      DeviceManager.cancelEditDevice(this);
    },

    onProviderTypeChange() {
      DeviceManager.onProviderTypeChange(this);
    },

    async testDevice(deviceId) {
      await DeviceManager.testDevice(deviceId, this);
    },

    async deleteDevice(deviceId) {
      await DeviceManager.deleteDevice(deviceId, this);
    },

    // ===== 分类管理方法（调用模块） =====
    editCategory(category) {
      CategoryManager.editCategory(category, this);
    },

    async saveCategory() {
      await CategoryManager.saveCategory(this);
    },

    getCategoryTaskCount(categoryId) {
      return CategoryManager.getCategoryTaskCount(categoryId, this.tasks);
    },

    // 获取分类名称
    getCategoryName(categoryId) {
      const category = this.categories.find(c => c.id === categoryId);
      return category ? category.name : '未分类';
    },

    // ===== UI 辅助方法 =====
    onScheduleTypeChange() {
      UIUtils.onScheduleTypeChange(this);
    },

    formatSchedule(schedule) {
      return UIUtils.formatSchedule(schedule);
    },

    formatTime(time) {
      return UIUtils.formatTime(time);
    },

    // 预览每N个月的执行计划
    previewMonthlySchedule() {
      const { firstDate, interval, time } = this.taskForm.schedule;
      if (!firstDate || !interval || !time) return '';

      const first = dayjs(`${firstDate} ${time}`);
      const now = dayjs();
      const schedules = [];

      // 生成前4次的执行时间
      for (let i = 0; i < 4; i++) {
        const scheduleDate = first.add(i * interval, 'month');
        const dateStr = scheduleDate.format('YYYY-MM-DD HH:mm');
        const isNext = scheduleDate.isAfter(now) && (i === 0 || schedules[i-1].indexOf('✓') === -1);

        if (scheduleDate.isBefore(now)) {
          schedules.push(`<span class="line-through opacity-60">${dateStr}</span>`);
        } else if (isNext) {
          schedules.push(`<strong class="text-blue-800">${dateStr} ← 下次执行</strong>`);
        } else {
          schedules.push(dateStr);
        }
      }

      return schedules.join('<br>');
    },

    // 限制日期输入，确保年份为4位且在安全区间
    sanitizeDateInput(fieldKey, finalize = false, event) {
      let rawValue = event?.target?.value ?? this.taskForm.schedule[fieldKey];
      if (!rawValue) {
        this.taskForm.schedule[fieldKey] = rawValue;
        return;
      }

      // 标准化分隔符并移除非法字符，仅保留数字和连字符
      rawValue = rawValue.replace(/\//g, '-').replace(/[^\d-]/g, '');
      const originalSegments = rawValue.split('-');
      let [year = '', month = '', day = ''] = originalSegments;

      if (year.length > 4) year = year.slice(0, 4);
      if (month.length > 2) month = month.slice(0, 2);
      if (day.length > 2) day = day.slice(0, 2);

      if (finalize && year.length === 4) {
        const numericYear = Math.min(Math.max(parseInt(year, 10) || 0, 1900), 2099);
        year = numericYear.toString().padStart(4, '0');
      }

      const segmentCount = Math.max(originalSegments.length, 1);
      let sanitized = year;
      if (segmentCount >= 2) {
        sanitized += `-${month}`;
      }
      if (segmentCount >= 3) {
        sanitized += `-${day}`;
      }

      // 最终只保留标准长度
      if (sanitized.length > 10) {
        sanitized = sanitized.slice(0, 10);
      }

      this.taskForm.schedule[fieldKey] = sanitized;
      if (event?.target) {
        event.target.value = sanitized;
      }
    },

    // 重置表单
    resetTaskForm() {
      TaskManager.resetTaskForm(this);
    },

    resetDeviceForm() {
      DeviceManager.resetDeviceForm(this);
    },

    resetCategoryForm() {
      CategoryManager.resetCategoryForm(this);
    },

    // 显示消息
    showMessage(type, title, text) {
      UIUtils.showMessage(this, type, title, text);
    },

    // 打开/关闭弹窗
    openModal(type) {
      // 打开模态框前先重置对应的表单数据
      if (type === 'task' && !this.editingTask) {
        this.resetTaskForm();
      } else if (type === 'category' && !this.editingCategory) {
        this.resetCategoryForm();
      }
      this.activeModal = type;
    },

    closeModal() {
      // 先记住当前模态框类型
      const modalType = this.activeModal;
      // 立即关闭模态框
      this.activeModal = null;

      // 延迟重置表单数据，避免闪现问题
      setTimeout(() => {
        if (modalType === 'task') {
          this.resetTaskForm();
        } else if (modalType === 'category') {
          this.resetCategoryForm();
        } else if (modalType === 'device') {
          this.resetDeviceForm();
          // 确保退出编辑状态
          this.editingDevice = null;
        }
      }, 300); // 等待过渡动画完成
    }
  };
}