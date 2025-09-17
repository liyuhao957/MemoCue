/**
 * 实时通信管理器 - 处理 SSE 服务器推送事件
 * 负责建立连接、处理重连、分发事件
 */
const RealtimeManager = {
  eventSource: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  isConnected: false,
  app: null,

  // 初始化 SSE 连接
  initialize(app) {
    this.app = app;
    this.connect();

    // 页面隐藏时断开连接，显示时重连
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.disconnect();
      } else {
        this.connect();
      }
    });

    // 页面卸载前清理连接
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });

    console.log('实时通信管理器已初始化');
  },

  // 建立 SSE 连接
  connect() {
    if (this.eventSource) {
      return; // 已连接
    }

    try {
      this.eventSource = new EventSource('/api/events');
      
      // 连接打开
      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('SSE 连接已建立');
        this.showConnectionStatus('connected');
      };

      // 接收消息
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('解析 SSE 消息失败:', error);
        }
      };

      // 连接错误
      this.eventSource.onerror = (error) => {
        console.error('SSE 连接错误:', error);
        this.isConnected = false;
        this.showConnectionStatus('disconnected');
        
        // 自动重连
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('创建 SSE 连接失败:', error);
    }
  },

  // 断开连接
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log('SSE 连接已断开');
    }
  },

  // 处理接收到的消息
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log(`已连接到服务器, 连接ID: ${data.id}`);
        break;
        
      case 'execution_log':
        this.handleExecutionLog(data.data);
        break;
        
      case 'task_update':
        this.handleTaskUpdate(data.data);
        break;
        
      case 'stats_update':
        this.handleStatsUpdate(data.data);
        break;
        
      default:
        console.log('收到未知类型消息:', data);
    }
  },

  // 处理执行日志更新
  handleExecutionLog(log) {
    console.log('收到实时执行日志:', log);
    
    if (!this.app || !this.app.executionLogs) {
      return;
    }

    // 添加到日志列表前端（如果不存在）
    const exists = this.app.executionLogs.find(l => l.id === log.id);
    if (!exists) {
      // 添加到列表开头
      this.app.executionLogs.unshift(log);
      
      // 限制显示数量
      if (this.app.executionLogs.length > 100) {
        this.app.executionLogs.pop();
      }

      // 更新统计数据
      this.updateStats(log);
      
      // 高亮新记录
      this.highlightNewLog(log.id);
      
      // 显示通知
      this.showNotification(log);
    }

    // 更新对应任务的最后执行状态
    const task = this.app.tasks.find(t => t.id === log.taskId);
    if (task) {
      task.lastExecution = {
        status: log.status,
        timestamp: log.timestamp,
        error: log.error
      };
    }
  },

  // 处理任务更新
  handleTaskUpdate(task) {
    console.log('收到任务更新:', task);
    
    if (!this.app || !this.app.tasks) {
      return;
    }

    const index = this.app.tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      this.app.tasks[index] = task;
    }
  },

  // 处理统计更新
  handleStatsUpdate(stats) {
    console.log('收到统计更新:', stats);
    
    if (this.app) {
      Object.assign(this.app.executionStats, stats);
    }
  },

  // 更新统计数据
  updateStats(log) {
    if (!this.app) return;

    const today = new Date().toDateString();
    const logDate = new Date(log.timestamp).toDateString();
    
    if (logDate === today) {
      if (log.status === 'success') {
        this.app.todayStats.success++;
      } else {
        this.app.todayStats.failed++;
      }
      
      // 重新计算成功率
      const total = this.app.todayStats.success + this.app.todayStats.failed;
      if (total > 0) {
        this.app.todayStats.successRate = Math.round(
          (this.app.todayStats.success / total) * 100
        );
      }
    }
  },

  // 高亮新日志
  highlightNewLog(logId) {
    setTimeout(() => {
      const element = document.querySelector(`[data-log-id="${logId}"]`);
      if (element) {
        element.classList.add('log-highlight');
        setTimeout(() => {
          element.classList.remove('log-highlight');
        }, 2000);
      }
    }, 100);
  },

  // 显示通知
  showNotification(log) {
    // 可以在这里添加浏览器通知或页面内提示
    if (log.status === 'failed' && this.app) {
      this.app.showMessage(
        'error',
        '推送失败',
        `任务 "${log.taskTitle}" 推送失败`
      );
    }
  },

  // 显示连接状态
  showConnectionStatus(status) {
    const indicator = document.getElementById('connection-indicator');
    if (indicator) {
      indicator.className = `connection-${status}`;
      indicator.title = status === 'connected' ? '实时连接已建立' : '实时连接已断开';
    }
  },

  // 计划重连
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('已达最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`);
    
    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  },

  // 手动刷新（保留兼容性）
  async manualRefresh() {
    if (this.app) {
      await this.app.loadExecutionLogs();
      this.app.showMessage('success', '成功', '日志已刷新');
    }
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealtimeManager;
}