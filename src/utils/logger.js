const winston = require('winston');
const path = require('path');

// 日志级别配置
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// 日志颜色配置
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(colors);

// 日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台格式（开发环境）
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    return output;
  })
);

// 创建日志器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(process.env.DATA_DIR || './data', 'logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(process.env.DATA_DIR || './data', 'logs', 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// 始终添加控制台输出
logger.add(new winston.transports.Console({
  format: consoleFormat
}));

// 导出日志器
module.exports = logger;