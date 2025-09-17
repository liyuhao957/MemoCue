const BarkProvider = require('./bark-provider');
const logger = require('../utils/logger');

class ProviderFactory {
  constructor() {
    // 注册可用的推送提供者
    this.providers = {
      'bark': BarkProvider
      // 未来可添加更多提供者:
      // 'wechat': WechatProvider,
      // 'dingtalk': DingtalkProvider,
      // 'telegram': TelegramProvider
    };

    // 缓存实例
    this.instances = {};
  }

  // 创建推送提供者实例
  create(type) {
    if (!type) {
      throw new Error('Provider type is required');
    }

    const providerType = type.toLowerCase();

    // 检查是否已有缓存实例
    if (this.instances[providerType]) {
      return this.instances[providerType];
    }

    // 获取提供者类
    const ProviderClass = this.providers[providerType];
    if (!ProviderClass) {
      logger.error('Unknown provider type', { type: providerType });
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    // 创建新实例并缓存
    try {
      const instance = new ProviderClass();
      this.instances[providerType] = instance;
      logger.info('Provider instance created', { type: providerType });
      return instance;
    } catch (error) {
      logger.error('Failed to create provider instance', {
        type: providerType,
        error: error.message
      });
      throw error;
    }
  }

  // 获取所有可用的提供者类型
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  // 检查提供者类型是否支持
  isSupported(type) {
    return type && this.providers.hasOwnProperty(type.toLowerCase());
  }

  // 清除缓存的实例
  clearCache() {
    this.instances = {};
    logger.info('Provider cache cleared');
  }

  // 为了兼容性，添加getProvider方法作为create的别名
  getProvider(type) {
    return this.create(type);
  }
}

// 导出单例
module.exports = new ProviderFactory();