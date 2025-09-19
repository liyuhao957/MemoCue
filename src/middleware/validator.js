const Joi = require('joi');
const logger = require('../utils/logger');

// 验证模式定义
const schemas = {
  // 任务相关
  task: Joi.object({
    title: Joi.string().min(1).max(1000).required(),  // 放宽到 1000 字符，支持长标题
    content: Joi.string().max(5000).allow('').optional(),  // 放宽到 5000 字符，支持详细内容
    deviceId: Joi.string().uuid().required(),
    categoryId: Joi.string().required(),
    schedule: Joi.object().required(),
    enabled: Joi.boolean().optional(),
    priority: Joi.number().valid(0, 1, 2).optional(),
    sound: Joi.string().max(50).optional(),
    icon: Joi.string().max(100).optional(),
    group: Joi.string().max(50).optional(),
    maxRetries: Joi.number().min(0).max(10).optional()
  }),

  taskUpdate: Joi.object({
    title: Joi.string().min(1).max(1000).optional(),  // 与创建保持一致
    content: Joi.string().max(5000).allow('').optional(),  // 与创建保持一致
    deviceId: Joi.string().uuid().optional(),
    categoryId: Joi.string().optional(),
    schedule: Joi.object().optional(),
    enabled: Joi.boolean().optional(),
    priority: Joi.number().valid(0, 1, 2).optional(),
    sound: Joi.string().max(50).optional(),
    icon: Joi.string().max(100).optional(),
    group: Joi.string().max(50).optional(),
    maxRetries: Joi.number().min(0).max(10).optional()
  }),

  // 设备相关
  device: Joi.object({
    name: Joi.string().min(1).max(50).required(),
    providerType: Joi.string().valid('bark', 'feishu').required(),
    providerConfig: Joi.object().required(),
    isDefault: Joi.boolean().optional(),
    isActive: Joi.boolean().optional()
  }),

  deviceUpdate: Joi.object({
    name: Joi.string().min(1).max(50).optional(),
    providerConfig: Joi.object().optional(),
    isDefault: Joi.boolean().optional(),
    isActive: Joi.boolean().optional()
  }),

  // 分类相关
  category: Joi.object({
    name: Joi.string().min(1).max(30).required(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: Joi.string().max(10).optional(),
    sortOrder: Joi.number().min(0).optional()
  }),

  categoryUpdate: Joi.object({
    name: Joi.string().min(1).max(30).optional(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: Joi.string().max(10).optional(),
    sortOrder: Joi.number().min(0).optional()
  }),

  // 推送测试
  pushTest: Joi.object({
    deviceId: Joi.string().uuid().required(),
    title: Joi.string().min(1).max(1000).required(),  // 测试也支持长文本
    content: Joi.string().max(5000).allow('').optional(),
    priority: Joi.number().valid(0, 1, 2).optional(),
    sound: Joi.string().max(50).optional()
  }),

  // 批量操作
  batchOperation: Joi.object({
    ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
    operation: Joi.string().valid('enable', 'disable', 'delete').required()
  }),

  // 查询参数
  queryParams: Joi.object({
    category: Joi.string().optional(),
    enabled: Joi.boolean().optional(),
    device: Joi.string().uuid().optional(),
    limit: Joi.number().min(1).max(100).optional(),
    offset: Joi.number().min(0).optional()
  })
};

// 创建验证中间件
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      logger.error('Validation schema not found', { schemaName });
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '验证配置错误'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    // 确定要验证的数据
    let data;
    if (req.method === 'GET') {
      data = req.query;
    } else {
      data = req.body;
    }

    // 执行验证
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation failed', {
        path: req.path,
        errors: details
      });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    // 将验证后的值替换原始数据
    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// 导出验证中间件和模式
module.exports = {
  validate,
  schemas
};