/**
 * 应用配置常量
 * 集中管理所有配置项，消除硬编码
 */

module.exports = {
  // 文件名配置
  FILES: {
    TASKS: 'tasks.json',
    DEVICES: 'devices.json',
    CATEGORIES: 'categories.json'
  },

  // 时间间隔配置（毫秒）
  INTERVALS: {
    TASK_REFRESH: 30000,        // 任务刷新间隔
    MESSAGE_DISPLAY: 3000,      // 消息显示时长
    RETRY_BASE: 1000,          // 重试基础延迟
    MAX_RETRY_DELAY: 30000     // 最大重试延迟
  },

  // API配置
  API: {
    BARK_SERVER: process.env.BARK_SERVER || 'https://api.day.app',
    DEFAULT_PORT: 3000
  },

  // HTTP状态码
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
  },

  // 调度配置
  SCHEDULER: {
    MAX_RETRIES: 3,
    CRON_TIMEZONE: 'Asia/Shanghai'
  }
};