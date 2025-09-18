// 设备管理模块
window.DeviceManager = {
  // 编辑设备
  editDevice(device, app) {
    // 防止重复点击同一设备
    if (app.editingDevice && app.editingDevice.id === device.id) {
      // 如果点击当前编辑的设备，则取消编辑
      this.cancelEditDevice(app);
      return;
    }

    // 如果正在编辑其他设备，先重置
    if (app.editingDevice) {
      this.resetDeviceForm(app);
    }

    app.editingDevice = device;

    // 填充表单数据
    app.deviceForm.name = device.name;
    app.deviceForm.providerType = device.providerType;

    // 根据设备类型清空表单，不填充任何默认值或敏感信息
    if (device.providerType === 'bark') {
      app.deviceForm.server = '';  // 编辑时不填充默认值，避免覆盖
      app.deviceForm.key = '';  // 敏感信息留空
      app.deviceForm.webhookUrl = '';
      app.deviceForm.secret = '';
      app.deviceForm.messageType = 'auto';
    } else if (device.providerType === 'feishu') {
      app.deviceForm.server = '';
      app.deviceForm.key = '';
      app.deviceForm.webhookUrl = '';  // 敏感信息留空
      app.deviceForm.secret = '';  // 敏感信息留空
      app.deviceForm.messageType = '';  // 不设置默认值
    }

    // 滚动到表单位置（提升用户体验）
    setTimeout(() => {
      const formElement = document.querySelector('.device-modal__form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  },

  // 取消编辑
  cancelEditDevice(app) {
    app.editingDevice = null;
    this.resetDeviceForm(app);
  },

  // 保存设备（新增或更新）
  async saveDevice(app) {
    if (app.editingDevice) {
      await this.updateDevice(app);
    } else {
      await this.addDevice(app);
    }
  },

  // 更新设备
  async updateDevice(app) {
    // 防止重复提交
    if (app.savingDevice) return;

    app.savingDevice = true;
    try {
      // 验证设备名称
      if (!app.deviceForm.name || !app.deviceForm.name.trim()) {
        app.showMessage('error', '验证失败', '设备名称不能为空');
        app.savingDevice = false;
        return;
      }

      // 检查名称是否与其他设备重复
      const otherDevices = app.devices.filter(d => d.id !== app.editingDevice.id);
      if (otherDevices.some(d => d.name === app.deviceForm.name.trim())) {
        app.showMessage('error', '验证失败', '设备名称已存在');
        app.savingDevice = false;
        return;
      }

      const updateData = {
        name: app.deviceForm.name.trim()
      };

      // 构建配置，只包含用户明确填写的字段
      let providerConfig = null;

      if (app.deviceForm.providerType === 'bark') {
        // 只有当用户填写了任意Bark配置字段时才更新
        const hasAnyBarkField = app.deviceForm.server || app.deviceForm.key;

        if (hasAnyBarkField) {
          // 验证：如果填写了任意字段，则必须提供完整配置
          if (!app.deviceForm.server || !app.deviceForm.key) {
            app.showMessage('error', '验证失败', '编辑Bark设备时，如需修改配置请同时提供服务器地址和Key');
            app.savingDevice = false;
            return;
          }

          if (!app.deviceForm.server.startsWith('http')) {
            app.showMessage('error', '验证失败', 'Bark服务器地址必须以 http:// 或 https:// 开头');
            app.savingDevice = false;
            return;
          }

          providerConfig = {
            server: app.deviceForm.server.trim(),
            key: app.deviceForm.key.trim()
          };
        }
      } else if (app.deviceForm.providerType === 'feishu') {
        // 只有当用户填写了任意飞书配置字段时才更新
        const hasAnyFeishuField = app.deviceForm.webhookUrl || app.deviceForm.secret || app.deviceForm.messageType;

        if (hasAnyFeishuField) {
          // 验证：如果填写了任意字段，则webhookUrl是必填的
          if (!app.deviceForm.webhookUrl) {
            app.showMessage('error', '验证失败', '编辑飞书设备时，如需修改配置请提供Webhook URL');
            app.savingDevice = false;
            return;
          }

          if (!app.deviceForm.webhookUrl.includes('feishu.cn')) {
            app.showMessage('warning', '提示', 'Webhook URL 可能不正确，请确认是否为飞书机器人地址');
          }

          providerConfig = {
            webhookUrl: app.deviceForm.webhookUrl.trim()
          };

          // 只有当用户明确填写了secret才添加
          if (app.deviceForm.secret) {
            providerConfig.secret = app.deviceForm.secret.trim();
          }

          // 只有当用户明确选择了messageType才添加（不使用默认值）
          if (app.deviceForm.messageType) {
            providerConfig.messageType = app.deviceForm.messageType;
          }
        }
      }

      // 只有当有配置更新时才包含providerConfig
      if (providerConfig) {
        updateData.providerConfig = providerConfig;
      }

      await app.api(`/api/devices/${app.editingDevice.id}`, {
        method: 'PUT',
        body: updateData
      });

      await app.loadDevices();
      app.editingDevice = null;
      app.resetDeviceForm();
      app.showMessage('success', '成功', `设备"${updateData.name}"已更新`);
    } catch (error) {
      app.showMessage('error', '更新失败', error.message || '请检查网络连接并重试');
    } finally {
      app.savingDevice = false;
    }
  },

  // 添加设备
  async addDevice(app) {
    // 防止重复提交
    if (app.savingDevice) return;

    app.savingDevice = true;
    try {
      // 验证设备名称
      if (!app.deviceForm.name || !app.deviceForm.name.trim()) {
        app.showMessage('error', '验证失败', '请输入设备名称');
        app.savingDevice = false;
        return;
      }

      // 检查名称是否重复
      if (app.devices.some(d => d.name === app.deviceForm.name.trim())) {
        app.showMessage('error', '验证失败', '设备名称已存在');
        app.savingDevice = false;
        return;
      }

      let providerConfig = {};

      // 根据提供者类型构建配置并验证
      if (app.deviceForm.providerType === 'bark') {
        if (!app.deviceForm.key || !app.deviceForm.key.trim()) {
          app.showMessage('error', '验证失败', '请输入 Bark 设备 Key');
          app.savingDevice = false;
          return;
        }
        if (!app.deviceForm.server || !app.deviceForm.server.startsWith('http')) {
          app.showMessage('error', '验证失败', 'Bark服务器地址必须以 http:// 或 https:// 开头');
          app.savingDevice = false;
          return;
        }
        providerConfig = {
          server: app.deviceForm.server.trim(),
          key: app.deviceForm.key.trim()
        };
      } else if (app.deviceForm.providerType === 'feishu') {
        if (!app.deviceForm.webhookUrl || !app.deviceForm.webhookUrl.trim()) {
          app.showMessage('error', '验证失败', '请输入飞书 Webhook URL');
          app.savingDevice = false;
          return;
        }
        if (!app.deviceForm.webhookUrl.includes('feishu.cn')) {
          app.showMessage('warning', '提示', 'Webhook URL 可能不正确，请确认是否为飞书机器人地址');
        }
        providerConfig = {
          webhookUrl: app.deviceForm.webhookUrl.trim(),
          secret: app.deviceForm.secret ? app.deviceForm.secret.trim() : '',
          messageType: app.deviceForm.messageType || 'auto'
        };
      }

      const data = {
        name: app.deviceForm.name.trim(),
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
      app.showMessage('success', '成功', `设备"${data.name}"已添加${data.isDefault ? '并设为默认' : ''}`);
    } catch (error) {
      app.showMessage('error', '添加失败', error.message || '请检查网络连接并重试');
    } finally {
      app.savingDevice = false;
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
    app.editingDevice = null;
    app.savingDevice = false;  // 确保重置保存状态
  },

  // 提供者类型改变处理
  onProviderTypeChange(app) {
    // 编辑模式下不允许改变类型
    if (app.editingDevice) {
      app.deviceForm.providerType = app.editingDevice.providerType;
      app.showMessage('warning', '提示', '编辑模式下不能修改推送类型');
      return;
    }

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
  },

  // 验证设备配置完整性
  validateDeviceConfig(app) {
    const form = app.deviceForm;

    // 基础验证
    if (!form.name || !form.name.trim()) {
      return { valid: false, message: '请输入设备名称' };
    }

    // 根据类型验证
    if (form.providerType === 'bark') {
      if (!app.editingDevice && (!form.key || !form.key.trim())) {
        return { valid: false, message: '请输入 Bark 设备 Key' };
      }
      if (form.server && !form.server.startsWith('http')) {
        return { valid: false, message: 'Bark服务器地址格式不正确' };
      }
    } else if (form.providerType === 'feishu') {
      if (!app.editingDevice && (!form.webhookUrl || !form.webhookUrl.trim())) {
        return { valid: false, message: '请输入飞书 Webhook URL' };
      }
    }

    return { valid: true };
  }
};