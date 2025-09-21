// SSE 连接管理器 - 轻量级实时推送实现
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // 存储所有活跃连接
    this.connectionId = 0;

    // 监听进程退出事件，清理所有连接
    process.on('SIGTERM', () => this.cleanupAllConnections());
    process.on('SIGINT', () => this.cleanupAllConnections());
    process.on('beforeExit', () => this.cleanupAllConnections());
  }

  // 添加新的SSE连接
  addConnection(req, res) {
    const id = ++this.connectionId;

    // 设置SSE响应头
    // 注意：CORS 已经在全局中间件处理，这里只设置 SSE 特定头部
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
      // 移除 Access-Control-Allow-Origin，使用全局 CORS 配置
    });

    // 发送初始连接确认
    res.write(`data: {"type":"connected","id":${id}}\n\n`);

    // 保存连接
    this.connections.set(id, res);
    logger.info(`SSE connection established: ${id}`);

    // 心跳保持连接活跃
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);

    // 连接关闭时清理
    req.on('close', () => {
      clearInterval(heartbeat);
      this.connections.delete(id);
      logger.info(`SSE connection closed: ${id}`);
    });

    return id;
  }

  // 向所有连接推送执行日志
  pushExecutionLog(log) {
    const data = JSON.stringify({
      type: 'execution_log',
      data: log
    });

    this.connections.forEach((res, id) => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        logger.error(`Failed to push to connection ${id}:`, error);
        this.connections.delete(id);
      }
    });

    logger.debug(`Pushed execution log to ${this.connections.size} clients`);
  }

  // 推送任务状态更新
  pushTaskUpdate(task) {
    const data = JSON.stringify({
      type: 'task_update',
      data: task
    });

    this.connections.forEach((res) => {
      res.write(`data: ${data}\n\n`);
    });
  }

  // 推送统计数据更新
  pushStatsUpdate(stats) {
    const data = JSON.stringify({
      type: 'stats_update',
      data: stats
    });

    this.connections.forEach((res) => {
      res.write(`data: ${data}\n\n`);
    });
  }

  // 获取连接数
  getConnectionCount() {
    return this.connections.size;
  }

  // 清理所有连接（进程退出时调用）
  cleanupAllConnections() {
    logger.info(`Cleaning up ${this.connections.size} SSE connections`);

    this.connections.forEach((res, id) => {
      try {
        // 发送关闭通知
        res.write('data: {"type":"server_shutdown"}\n\n');
        res.end();
      } catch (error) {
        // 忽略错误，连接可能已经关闭
      }
    });

    // 清空连接映射
    this.connections.clear();
  }

  // 检查并清理死连接
  checkAndCleanDeadConnections() {
    const deadConnections = [];

    this.connections.forEach((res, id) => {
      // 检查连接是否仍然有效
      if (res.destroyed || res.finished) {
        deadConnections.push(id);
      }
    });

    // 清理死连接
    deadConnections.forEach(id => {
      this.connections.delete(id);
      logger.debug(`Cleaned up dead SSE connection: ${id}`);
    });

    if (deadConnections.length > 0) {
      logger.info(`Cleaned ${deadConnections.length} dead SSE connections`);
    }
  }
}

// 单例模式
const sseManager = new SSEManager();

// 定期检查并清理死连接（60秒一次）
setInterval(() => {
  sseManager.checkAndCleanDeadConnections();
}, 60000);

module.exports = sseManager;