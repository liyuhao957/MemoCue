// SSE 连接管理器 - 轻量级实时推送实现
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // 存储所有活跃连接
    this.connectionId = 0;
  }

  // 添加新的SSE连接
  addConnection(req, res) {
    const id = ++this.connectionId;
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
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
}

// 单例模式
module.exports = new SSEManager();