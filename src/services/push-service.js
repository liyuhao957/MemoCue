const logger = require('../utils/logger');

// 推送服务基类
class PushProvider {
  constructor() {
    if (new.target === PushProvider) {
      throw new Error('PushProvider is an abstract class and cannot be instantiated directly');
    }
  }

  // 发送推送消息
  async send(device, message) {
    throw new Error('send method must be implemented by subclass');
  }

  // 测试设备连接
  async test(device) {
    throw new Error('test method must be implemented by subclass');
  }

  // 验证设备配置
  validateConfig(config) {
    throw new Error('validateConfig method must be implemented by subclass');
  }

  // 格式化消息
  formatMessage(message) {
    const defaultMessage = {
      title: message.title || '提醒',
      content: message.content || '',
      priority: message.priority || 0,
      sound: message.sound || 'default',
      icon: message.icon,
      group: message.group,
      url: message.url,
      badge: message.badge,
      // Bark 特定字段
      barkSound: message.barkSound,
      barkUrl: message.barkUrl
    };

    return defaultMessage;
  }

  // 处理推送结果
  handleResult(result, device) {
    if (result.success) {
      logger.info('Push notification sent successfully', {
        deviceId: device.id,
        deviceName: device.name
      });
    } else {
      logger.error('Failed to send push notification', {
        deviceId: device.id,
        deviceName: device.name,
        error: result.error
      });
    }
    return result;
  }
}

module.exports = PushProvider;