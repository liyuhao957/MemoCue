const axios = require('axios');
const crypto = require('crypto');
const PushProvider = require('../services/push-service');
const logger = require('../utils/logger');
const cryptoUtil = require('../utils/crypto');

class FeishuProvider extends PushProvider {
  constructor() {
    super();
    this.name = 'feishu';
  }

  // 验证飞书配置
  validateConfig(config) {
    if (!config.webhookUrl) {
      throw new Error('飞书配置需要webhookUrl参数');
    }

    // 确保webhook URL格式正确
    try {
      const url = new URL(config.webhookUrl);
      if (!url.hostname.includes('feishu.cn') && !url.hostname.includes('larksuite.com')) {
        logger.warn('Webhook URL may not be a valid Feishu URL', { url: config.webhookUrl });
      }
    } catch (error) {
      throw new Error('飞书 webhook URL格式不正确');
    }

    // 可选的安全验证
    if (config.secret && typeof config.secret !== 'string') {
      throw new Error('飞书安全密钥必须是字符串');
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

  // 生成签名（用于安全验证）
  generateSignature(timestamp, secret) {
    // 飞书签名算法：使用 secret 作为密钥，timestamp\nsecret 作为消息
    const stringToSign = `${timestamp}\n${secret}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('base64');
    return signature;
  }

  // 构建文本消息
  buildTextMessage(message) {
    return {
      msg_type: 'text',
      content: {
        text: `${message.title}\n${message.content}`
      }
    };
  }

  // 构建富文本消息
  buildRichTextMessage(message) {
    const elements = [];

    // 标题 - 使用正确的样式对象格式
    if (message.title) {
      elements.push([
        {
          tag: 'text',
          text: message.title,
          style: {
            bold: true
          }
        }
      ]);
    }

    // 内容
    if (message.content) {
      elements.push([
        {
          tag: 'text',
          text: message.content
        }
      ]);
    }

    // URL链接
    if (message.url) {
      elements.push([
        {
          tag: 'a',
          text: '查看详情',
          href: message.url
        }
      ]);
    }

    return {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: message.title || '提醒',
            content: elements
          }
        }
      }
    };
  }

  // 构建卡片消息（更丰富的展示）
  buildCardMessage(message) {
    const elements = [];

    // 内容区域
    if (message.content) {
      elements.push({
        tag: 'div',
        text: {
          content: message.content,
          tag: 'plain_text'
        }
      });
    }

    // 添加分组信息
    if (message.group || message.categoryName) {
      elements.push({
        tag: 'note',
        elements: [{
          tag: 'plain_text',
          content: `分类: ${message.categoryName || message.group || '默认'}`
        }]
      });
    }

    // 操作按钮
    if (message.url) {
      elements.push({
        tag: 'action',
        actions: [{
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '查看详情'
          },
          type: 'primary',
          url: message.url
        }]
      });
    }

    // 优先级到颜色的映射
    const priorityColors = {
      2: 'red',     // 高优先级
      1: 'orange',  // 中优先级
      0: 'blue'     // 默认
    };
    const templateColor = priorityColors[message.priority] || 'blue';

    return {
      msg_type: 'interactive',
      card: {
        config: {
          wide_screen_mode: true,
          enable_forward: true
        },
        header: {
          title: {
            tag: 'plain_text',
            content: message.title || '提醒通知'
          },
          template: templateColor
        },
        elements: elements
      }
    };
  }

  // 选择消息类型
  selectMessageType(config, message) {
    const messageType = config.messageType || 'auto';

    // 消息构建策略映射
    const messageBuilders = {
      'text': () => this.buildTextMessage(message),
      'rich_text': () => this.buildRichTextMessage(message),
      'card': () => this.buildCardMessage(message),
      'auto': () => {
        // 自动选择：有URL或高优先级用卡片，否则用文本
        return (message.url || message.priority >= 1)
          ? this.buildCardMessage(message)
          : this.buildTextMessage(message);
      }
    };

    const builder = messageBuilders[messageType] || messageBuilders['auto'];
    return builder();
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

      // 添加分类名称（如果有）
      if (message.categoryName) {
        formattedMessage.categoryName = message.categoryName;
      }

      // 构建请求数据
      const requestData = this.selectMessageType(config, formattedMessage);

      // 如果配置了安全密钥，添加签名
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'MemoCue/1.0'
      };

      if (config.secret) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = this.generateSignature(timestamp, config.secret);
        requestData.timestamp = String(timestamp);
        requestData.sign = signature;
      }

      // 发送请求
      const response = await axios.post(config.webhookUrl, requestData, {
        headers,
        timeout: 10000
      });

      // 检查响应
      if (response.data && response.data.code === 0) {
        return this.handleResult({
          success: true,
          messageId: response.data.msg || Date.now().toString(),
          response: response.data
        }, device);
      } else if (response.data && response.data.StatusCode === 0) {
        // 兼容不同的响应格式
        return this.handleResult({
          success: true,
          messageId: Date.now().toString(),
          response: response.data
        }, device);
      } else {
        throw new Error(response.data?.msg || response.data?.StatusMessage || '推送失败');
      }

    } catch (error) {
      logger.error('Feishu push failed', {
        deviceId: device.id,
        error: error.message,
        stack: error.stack,
        response: error.response?.data
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
        content: '✅ 飞书机器人配置成功！\n这是一条来自 MemoCue 的测试消息。',
        priority: 0,
        group: '测试'
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

module.exports = FeishuProvider;