const logger = require('../utils/logger');

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 记录错误
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // 判断错误类型
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let errorMessage = '服务器内部错误';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    errorMessage = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'AUTH_ERROR';
    errorMessage = '认证失败';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    errorMessage = '权限不足';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    errorMessage = '资源不存在';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    errorCode = 'CONFLICT';
    errorMessage = '资源冲突';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    errorMessage = err.message;
  }

  // 发送错误响应
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

// 404 处理中间件
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

// 自定义错误类
class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

class NotFoundError extends ApiError {
  constructor(message = '资源不存在') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends ApiError {
  constructor(message = '资源冲突') {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

class ForbiddenError extends ApiError {
  constructor(message = '权限不足') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  ApiError,
  NotFoundError,
  ConflictError,
  ForbiddenError
};