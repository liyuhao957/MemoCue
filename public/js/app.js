// 配置 dayjs
dayjs.locale('zh-cn');

// Alpine.js 应用
function memoCueApp() {
  return {
    // 状态数据
    tasks: [],
    categories: [],
    devices: [],
    currentCategory: 'all',
    searchQuery: '',
    message: null,

    // 模态框状态（互斥）
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
        expression: ''
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

      // 确保首次进入不会误开弹窗
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

    // 获取分类任务数
    getCategoryTaskCount(categoryId) {
      return this.tasks.filter(t => t.categoryId === categoryId).length;
    },

    // 切换任务状态
    async toggleTask(taskId) {
      try {
        await this.api(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' });
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          task.enabled = !task.enabled;
        }
        this.showMessage('success', '成功', '任务状态已更新');
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 编辑任务
    editTask(task) {
      this.editingTask = task;
      this.taskForm = {
        title: task.title,
        content: task.content || '',
        deviceId: task.deviceId,
        categoryId: task.categoryId,
        schedule: { ...task.schedule },
        priority: task.priority || 0,
        sound: task.sound || 'default'
      };
      this.openModal('task');
    },

    // 保存任务
    async saveTask() {
      try {
        const data = { ...this.taskForm };

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
          case 'cron':
            schedule.type = 'cron';
            schedule.expression = data.schedule.expression;
            break;
        }
        data.schedule = schedule;

        if (this.editingTask) {
          // 更新任务
          await this.api(`/api/tasks/${this.editingTask.id}`, {
            method: 'PUT',
            body: data
          });
          this.showMessage('success', '成功', '任务已更新');
        } else {
          // 创建任务
          await this.api('/api/tasks', {
            method: 'POST',
            body: data
          });
          this.showMessage('success', '成功', '任务已创建');
        }

        await this.loadTasks();
        this.closeModal();
        this.resetTaskForm();
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 删除任务
    async deleteTask(taskId) {
      if (!confirm('确定删除这个提醒吗？')) return;

      try {
        await this.api(`/api/tasks/${taskId}`, { method: 'DELETE' });
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.showMessage('success', '成功', '任务已删除');
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 测试推送
    async testPush(task) {
      try {
        await this.api(`/api/push/${task.id}`, { method: 'POST' });
        this.showMessage('success', '成功', '推送已发送');
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 添加设备
    async addDevice() {
      try {
        const data = {
          name: this.deviceForm.name,
          providerType: 'bark',
          providerConfig: {
            server: this.deviceForm.server,
            key: this.deviceForm.key
          },
          isDefault: this.devices.length === 0
        };

        await this.api('/api/devices', {
          method: 'POST',
          body: data
        });

        await this.loadDevices();
        this.resetDeviceForm();
        this.showMessage('success', '成功', '设备已添加');
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 测试设备
    async testDevice(deviceId) {
      try {
        const result = await this.api(`/api/devices/${deviceId}/test`, {
          method: 'POST'
        });
        if (result.success) {
          this.showMessage('success', '成功', result.message);
        } else {
          this.showMessage('error', '失败', result.message);
        }
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 删除设备
    async deleteDevice(deviceId) {
      if (!confirm('确定删除这个设备吗？')) return;

      try {
        await this.api(`/api/devices/${deviceId}`, { method: 'DELETE' });
        await this.loadDevices();
        this.showMessage('success', '成功', '设备已删除');
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 编辑分类
    editCategory(category) {
      this.editingCategory = category;
      this.categoryForm = {
        name: category.name,
        icon: category.icon || '📁',
        color: category.color || '#4F46E5'
      };
      this.openModal('category');
    },

    // 保存分类
    async saveCategory() {
      try {
        if (this.editingCategory) {
          // 更新分类
          await this.api(`/api/categories/${this.editingCategory.id}`, {
            method: 'PUT',
            body: this.categoryForm
          });
          this.showMessage('success', '成功', '分类已更新');
        } else {
          // 创建分类
          await this.api('/api/categories', {
            method: 'POST',
            body: this.categoryForm
          });
          this.showMessage('success', '成功', '分类已创建');
        }

        await this.loadCategories();
        this.closeModal();
        this.resetCategoryForm();
      } catch (error) {
        this.showMessage('error', '失败', error.message);
      }
    },

    // 调度类型改变
    onScheduleTypeChange() {
      const type = this.taskForm.schedule.type;
      // 设置默认值
      switch (type) {
        case 'once':
          this.taskForm.schedule.datetime = dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm');
          break;
        case 'hourly':
          this.taskForm.schedule.minute = 0; // 默认整点
          this.taskForm.schedule.startHour = '';
          this.taskForm.schedule.endHour = '';
          break;
        case 'weekly':
          this.taskForm.schedule.days = [1]; // 默认周一
          break;
      }
    },

    // 格式化调度信息
    formatSchedule(schedule) {
      switch (schedule.type) {
        case 'hourly':
          let hourlyText = `每小时第${schedule.minute}分钟`;
          if (schedule.startHour !== undefined && schedule.endHour !== undefined) {
            hourlyText += ` (${schedule.startHour}:00-${schedule.endHour}:00)`;
          }
          return hourlyText;
        case 'once':
          return `单次 ${dayjs(schedule.datetime).format('MM-DD HH:mm')}`;
        case 'daily':
          return `每天 ${schedule.time}`;
        case 'weekly':
          const days = schedule.days.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、');
          return `每周${days} ${schedule.time}`;
        case 'monthly':
          return `每月${schedule.day}日 ${schedule.time}`;
        case 'cron':
          return `Cron: ${schedule.expression}`;
        default:
          return '未知';
      }
    },

    // 格式化时间
    formatTime(time) {
      if (!time) return '';
      return dayjs(time).format('MM-DD HH:mm');
    },

    // 重置表单
    resetTaskForm() {
      this.editingTask = null;
      this.taskForm = {
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
          endHour: ''
        },
        priority: 0,
        sound: 'default'
      };
    },

    resetDeviceForm() {
      this.deviceForm = {
        name: '',
        server: 'https://api.day.app',
        key: ''
      };
    },

    resetCategoryForm() {
      this.editingCategory = null;
      this.categoryForm = {
        name: '',
        icon: '📁',
        color: '#4F46E5'
      };
    },

    // 显示消息
    showMessage(type, title, text) {
      this.message = { type, title, text };
      setTimeout(() => {
        this.message = null;
      }, 3000);
    },

    // 打开/关闭弹窗（互斥）
    openModal(type) {
      this.activeModal = type; // 保证同一时间仅一个弹窗
    },
    closeModal() {
      this.activeModal = null;
    }
  };
}
