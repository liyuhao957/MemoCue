// 设备管理模块
window.DeviceManager = {
  // 添加设备
  async addDevice(app) {
    try {
      const data = {
        name: app.deviceForm.name,
        providerType: 'bark',
        providerConfig: {
          server: app.deviceForm.server,
          key: app.deviceForm.key
        },
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
      server: 'https://api.day.app',
      key: ''
    };
  }
};