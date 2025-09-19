const axios = require('axios');
const PushProvider = require('../services/push-service');
const logger = require('../utils/logger');
const cryptoUtil = require('../utils/crypto');

class BarkProvider extends PushProvider {
  constructor() {
    super();
    this.name = 'bark';
  }

  // 验证Bark配置
  validateConfig(config) {
    if (!config.server || !config.key) {
      throw new Error('Bark配置需要server和key参数');
    }

    // 确保server URL格式正确
    try {
      new URL(config.server);
    } catch (error) {
      throw new Error('Bark server URL格式不正确');
    }

    return true;
  }

  // 解密设备配置
  decryptConfig(device) {
    const encryptionSecret = process.env.ENCRYPTION_SECRET || 'default-secret-change-me';
    try {
      const decrypted = cryptoUtil.decrypt(device.providerConfig, encryptionSecret);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt device config', {
        deviceId: device.id,
        error: error.message
      });
      throw new Error('设备配置解密失败');
    }
  }

  // 构建Bark推送URL
  buildUrl(config, message) {
    const { server, key } = config;
    const baseUrl = server.replace(/\/$/, ''); // 移除尾部斜杠

    // 构建基础URL
    let url = `${baseUrl}/${key}`;

    // 添加标题和内容
    const title = encodeURIComponent(message.title || '提醒');
    const body = encodeURIComponent(message.content || '');
    url += `/${title}/${body}`;

    return url;
  }

  // 构建请求参数
  buildParams(message) {
    const params = {};

    // 设置优先级
    if (message.priority === 2) {
      params.level = 'critical';
    } else if (message.priority === 1) {
      params.level = 'active';
    } else {
      params.level = 'passive';
    }

    // 设置声音（优先使用 barkSound，然后是 sound）
    if (message.barkSound && message.barkSound !== 'default') {
      params.sound = message.barkSound;
    } else if (message.sound && message.sound !== 'default') {
      params.sound = message.sound;
    }

    // 设置图标
    if (message.icon) {
      params.icon = message.icon;
    }

    // 设置分组
    if (message.group) {
      params.group = message.group;
    }

    // 设置URL（优先使用 barkUrl，然后是 url）
    if (message.barkUrl) {
      params.url = message.barkUrl;
    } else if (message.url) {
      params.url = message.url;
    }

    // 设置角标
    if (message.badge !== undefined) {
      params.badge = message.badge;
    }

    return params;
  }

  // 发送推送
  async send(device, message) {
    try {
      // 解密配置
      const config = this.decryptConfig(device);

      // 验证配置
      this.validateConfig(config);

      // 格式化消息
      const formattedMessage = this.formatMessage(message);

      // 构建URL和参数
      const url = this.buildUrl(config, formattedMessage);
      const params = this.buildParams(formattedMessage);

      // 发送请求
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'MemoCue/1.0'
        }
      });

      // 检查响应
      if (response.data && response.data.code === 200) {
        return this.handleResult({
          success: true,
          messageId: response.data.message || Date.now().toString(),
          response: response.data
        }, device);
      } else {
        throw new Error(response.data?.message || '推送失败');
      }

    } catch (error) {
      logger.error('Bark push failed', {
        deviceId: device.id,
        error: error.message,
        stack: error.stack
      });

      return this.handleResult({
        success: false,
        error: error.message
      }, device);
    }
  }

  // 测试设备连接
  async test(device) {
    try {
      // 发送测试消息
      const testMessage = {
        title: 'MemoCue 测试',
        content: '这是一条测试消息，如果您收到了这条消息，说明设备配置正确。',
        priority: 0,
        sound: 'default'
      };

      const result = await this.send(device, testMessage);

      return {
        success: result.success,
        message: result.success ? '测试成功' : '测试失败',
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        message: '测试失败',
        error: error.message
      };
    }
  }
}

module.exports = BarkProvider;