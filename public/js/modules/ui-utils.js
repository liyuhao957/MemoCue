// UI 工具模块
window.UIUtils = {
  // 调度类型改变
  onScheduleTypeChange(app) {
    const type = app.taskForm.schedule.type;
    // 设置默认值
    switch (type) {
      case 'once':
        app.taskForm.schedule.datetime = dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm');
        break;
      case 'hourly':
        app.taskForm.schedule.minute = 0; // 默认整点
        app.taskForm.schedule.startHour = '';
        app.taskForm.schedule.endHour = '';
        break;
      case 'weekly':
        app.taskForm.schedule.days = [1]; // 默认周一
        break;
      case 'monthly':
        app.taskForm.schedule.day = 1;
        app.taskForm.schedule.time = '10:00';
        break;
      case 'monthlyInterval':
        app.taskForm.schedule.interval = 3;
        app.taskForm.schedule.firstDate = dayjs().format('YYYY-MM-DD'); // 默认今天
        app.taskForm.schedule.time = '10:00';
        break;
    }
  },

  // 格式化调度信息
  formatSchedule(schedule) {
    switch (schedule.type) {
      case 'hourly':
        let hourlyText = `每小时第${schedule.minute}分钟`;
        // 只有当startHour和endHour都有有效值时才显示时间范围
        if (schedule.startHour !== undefined && schedule.startHour !== null &&
            schedule.startHour !== '' &&
            schedule.endHour !== undefined && schedule.endHour !== null &&
            schedule.endHour !== '') {
          hourlyText += ` (${schedule.startHour}:00-${schedule.endHour}:00)`;
        }
        return hourlyText;
      case 'once':
        return `单次 ${dayjs(schedule.datetime).format('MM-DD HH:mm')}`;
      case 'daily':
        return `每天 ${schedule.time}`;
      case 'weekly':
        const days = schedule.days.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、');
        return `每周${days} ${schedule.time}`;
      case 'monthly':
        return `每月${schedule.day}日 ${schedule.time}`;
      case 'monthlyInterval':
        if (schedule.firstDate) {
          const day = new Date(schedule.firstDate).getDate();
          return `每${schedule.interval}个月的${day}号 ${schedule.time}`;
        }
        return `每${schedule.interval}个月`;
      case 'cron':
        return `Cron: ${schedule.expression}`;
      default:
        return '未知';
    }
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return '';
    return dayjs(time).format('MM-DD HH:mm');
  },

  // 显示消息
  showMessage(app, type, title, text) {
    app.message = { type, title, text };
    setTimeout(() => {
      app.message = null;
    }, 3000);
  },

  // 截断文本
  truncateText(text, maxLength = 18) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  // 获取设备名称（兼容 deviceId 和 deviceIds）
  getDeviceName(devices, task) {
    // 优先使用 deviceId
    if (task.deviceId) {
      const device = devices.find(d => d.id === task.deviceId);
      return device ? device.name : '未知设备';
    }
    // 兼容 deviceIds 数组格式
    if (task.deviceIds && task.deviceIds.length > 0) {
      const deviceNames = task.deviceIds
        .map(id => {
          const device = devices.find(d => d.id === id);
          return device ? device.name : null;
        })
        .filter(name => name !== null);
      if (deviceNames.length === 0) return '未知设备';
      if (deviceNames.length === 1) return deviceNames[0];
      return deviceNames.join(' / ');
    }
    return '未知设备';
  },

  // 获取设备图标（兼容 deviceId 和 deviceIds）
  getDeviceIcon(devices, task) {
    // 优先使用 deviceId
    if (task.deviceId) {
      const device = devices.find(d => d.id === task.deviceId);
      if (!device) return '❓';
      return device.providerType === 'bark' ? '📱' : '🤖';
    }
    // 兼容 deviceIds 数组格式
    if (task.deviceIds && task.deviceIds.length > 0) {
      const firstDeviceId = task.deviceIds[0];
      const device = devices.find(d => d.id === firstDeviceId);
      if (!device) return '❓';
      if (task.deviceIds.length > 1) {
        return '📲'; // 多设备图标
      }
      return device.providerType === 'bark' ? '📱' : '🤖';
    }
    return '❓';
  },

  // 计算字符长度（汉字算2个，英文算1个）
  getCharLength(str) {
    if (!str) return 0;
    let length = 0;
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // 判断是否为中文字符（包括中文标点）
      if ((charCode >= 0x4e00 && charCode <= 0x9fff) || // 中文字符
          (charCode >= 0x3000 && charCode <= 0x303f) || // 中文标点
          (charCode >= 0xff00 && charCode <= 0xffef)) { // 全角字符
        length += 2;
      } else {
        length += 1;
      }
    }
    return length;
  },

  // 限制输入长度（考虑中文字符）
  limitInputLength(str, maxByteLength) {
    if (!str) return '';
    let byteLength = 0;
    let result = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const charCode = char.charCodeAt(0);
      const charByteLength = ((charCode >= 0x4e00 && charCode <= 0x9fff) ||
                              (charCode >= 0x3000 && charCode <= 0x303f) ||
                              (charCode >= 0xff00 && charCode <= 0xffef)) ? 2 : 1;

      if (byteLength + charByteLength > maxByteLength) {
        break;
      }

      result += char;
      byteLength += charByteLength;
    }

    return result;
  }
};