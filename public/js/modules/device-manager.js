// 设备管理模块
window.DeviceManager = {
  // 添加设备
  async addDevice(app) {
    try {
      let providerConfig = {};

      // 根据提供者类型构建配置
      if (app.deviceForm.providerType === 'bark') {
        providerConfig = {
          server: app.deviceForm.server,
          key: app.deviceForm.key
        };
      } else if (app.deviceForm.providerType === 'feishu') {
        providerConfig = {
          webhookUrl: app.deviceForm.webhookUrl,
          secret: app.deviceForm.secret || '',
          messageType: app.deviceForm.messageType || 'auto'
        };
      }

      const data = {
        name: app.deviceForm.name,
        providerType: app.deviceForm.providerType || 'bark',
        providerConfig: providerConfig,
        isDefault: app.devices.length === 0
      };

      await app.api('/api/devices', {
        method: 'POST',
        body: data
      });

      await app.loadDevices();
      app.resetDeviceForm();
      app.showMessage('success', '成功', '设备已添加');
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 测试设备
  async testDevice(deviceId, app) {
    try {
      const result = await app.api(`/api/devices/${deviceId}/test`, {
        method: 'POST'
      });
      if (result.success) {
        app.showMessage('success', '成功', result.message);
      } else {
        app.showMessage('error', '失败', result.message);
      }
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 删除设备
  async deleteDevice(deviceId, app) {
    if (!confirm('确定删除这个设备吗？')) return;

    try {
      await app.api(`/api/devices/${deviceId}`, { method: 'DELETE' });
      await app.loadDevices();
      app.showMessage('success', '成功', '设备已删除');
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 重置设备表单
  resetDeviceForm(app) {
    app.deviceForm = {
      name: '',
      providerType: 'bark',
      server: 'https://api.day.app',
      key: '',
      webhookUrl: '',
      secret: '',
      messageType: 'auto'
    };
  },

  // 提供者类型改变处理
  onProviderTypeChange(app) {
    // 清空特定字段
    if (app.deviceForm.providerType === 'bark') {
      app.deviceForm.webhookUrl = '';
      app.deviceForm.secret = '';
      app.deviceForm.messageType = 'auto';
      if (!app.deviceForm.server) {
        app.deviceForm.server = 'https://api.day.app';
      }
    } else if (app.deviceForm.providerType === 'feishu') {
      app.deviceForm.server = '';
      app.deviceForm.key = '';
    }
  }
};