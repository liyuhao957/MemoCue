// 配置 dayjs
dayjs.locale('zh-cn');

// Alpine.js 应用 - 模块化重构版
function memoCueApp() {
  return {
    // 状态数据
    tasks: [],
    categories: [],
    devices: [],
    currentCategory: 'all',
    searchQuery: '',
    message: null,

    // 模态框状态
    activeModal: null, // 'task' | 'device' | 'category' | null

    // 编辑状态
    editingTask: null,
    editingCategory: null,

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
        interval: 1
      },
      priority: 0,
      sound: 'default'
    },

    deviceForm: {
      name: '',
      server: 'https://api.day.app',
      key: ''
    },

    categoryForm: {
      name: '',
      icon: '📁',
      color: '#4F46E5'
    },

    // 初始化
    async init() {
      await this.loadData();
      // 每30秒刷新一次任务列表
      setInterval(() => this.loadTasks(), 30000);
      this.activeModal = null;
    },

    // 加载所有数据
    async loadData() {
      try {
        await Promise.all([
          this.loadTasks(),
          this.loadCategories(),
          this.loadDevices()
        ]);
      } catch (error) {
        this.showMessage('error', '加载失败', error.message);
      }
    },

    // 加载任务列表
    async loadTasks() {
      const response = await this.api('/api/tasks');
      if (response.data) {
        this.tasks = response.data;
      } else {
        this.tasks = response;
      }
    },

    // 加载分类列表
    async loadCategories() {
      this.categories = await this.api('/api/categories');
      // 确保有默认分类
      if (!this.categories.find(c => c.id === 'default')) {
        this.categories.unshift({
          id: 'default',
          name: '默认',
          icon: '📋',
          color: '#6B7280'
        });
      }
    },

    // 加载设备列表
    async loadDevices() {
      this.devices = await this.api('/api/devices');
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

      // 排序（最新的在前）
      return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // ===== 任务管理方法（调用模块） =====
    async toggleTask(taskId) {
      await TaskManager.toggleTask(taskId, this);
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

    // ===== 设备管理方法（调用模块） =====
    async addDevice() {
      await DeviceManager.addDevice(this);
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
        }
      }, 300); // 等待过渡动画完成
    }
  };
}