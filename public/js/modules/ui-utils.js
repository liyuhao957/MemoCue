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

  // 按字节截断文本（中文2字节，英文1字节，正确处理emoji和代理对）
  truncateByBytes(str, maxBytes, addEllipsis = true) {
    if (!str) return '';

    // 优先使用 Intl.Segmenter 进行字素簇级分割（更准确）
    let segments;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
        segments = Array.from(segmenter.segment(str), seg => seg.segment);
      } catch (e) {
        // 降级到 Array.from
        segments = Array.from(str);
      }
    } else {
      // 降级方案：使用 Array.from（处理代理对）
      segments = Array.from(str);
    }

    let bytes = 0;
    let result = [];
    let truncated = false;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      // 计算字符宽度（显示宽度近似）
      let segmentBytes = this.getSegmentWidth(segment);

      if (bytes + segmentBytes > maxBytes) {
        truncated = true;
        break;
      }

      bytes += segmentBytes;
      result.push(segment);
    }

    // 清理末尾的 ZWJ 和变体选择符
    let finalText = result.join('');
    if (truncated) {
      // 检查并移除末尾的不可见字符
      finalText = this.cleanTrailingInvisible(finalText);
      if (addEllipsis) {
        return finalText + '...';
      }
    }

    return finalText;
  },

  // 计算字符段宽度
  getSegmentWidth(segment) {
    // 默认宽度
    let width = 1;

    // 获取第一个码点（用于判断字符类型）
    const firstChar = segment.charAt(0);
    const code = firstChar.charCodeAt(0);

    // CJK 字符、全角字符等占 2 个宽度
    if ((code >= 0x4e00 && code <= 0x9fff) || // CJK统一汉字
        (code >= 0x3000 && code <= 0x303f) || // 中文标点
        (code >= 0xff00 && code <= 0xffef) || // 全角字符
        (code >= 0x3040 && code <= 0x309f) || // 平假名
        (code >= 0x30a0 && code <= 0x30ff) || // 片假名
        (code >= 0xac00 && code <= 0xd7af)) { // 韩文
      width = 2;
    }

    // Emoji 检测（兼容性更好的方式）
    if (this.isEmoji(segment)) {
      width = 2;
    }

    return width;
  },

  // 检测是否为 Emoji（兼容性方案）
  isEmoji(str) {
    // 首先尝试使用 Unicode 属性类
    try {
      if (/\p{Emoji}/u.test(str)) {
        return true;
      }
    } catch (e) {
      // 不支持 Unicode 属性类，使用备用方案
    }

    // 备用方案：基础 emoji 范围检测
    const emojiRanges = [
      /[\u{1F300}-\u{1F9FF}]/u, // 杂项符号和图形
      /[\u{1F600}-\u{1F64F}]/u, // 表情符号
      /[\u{1F680}-\u{1F6FF}]/u, // 交通和地图符号
      /[\u{2600}-\u{26FF}]/u,   // 杂项符号
      /[\u{2700}-\u{27BF}]/u,   // 印刷符号
      /[\u{1F900}-\u{1F9FF}]/u, // 补充符号和图形
      /[\u{1FA70}-\u{1FAFF}]/u  // 符号和图形扩展-A
    ];

    return emojiRanges.some(range => range.test(str));
  },

  // 清理末尾的不可见字符（ZWJ、变体选择符等）
  cleanTrailingInvisible(str) {
    if (!str) return str;

    // 需要清理的不可见字符
    const invisibleChars = [
      '\u200D', // Zero Width Joiner (ZWJ)
      '\uFE0F', // Variation Selector-16 (VS16)
      '\uFE0E', // Variation Selector-15 (VS15)
      '\u200C', // Zero Width Non-Joiner (ZWNJ)
      '\u2060', // Word Joiner
      '\uFEFF'  // Zero Width No-Break Space
    ];

    // 从末尾开始清理
    let result = str;
    while (result.length > 0) {
      const lastChar = result[result.length - 1];
      if (invisibleChars.includes(lastChar)) {
        result = result.slice(0, -1);
      } else {
        break;
      }
    }

    return result;
  },

  // 显示标题（最多24字符，12个中文）
  displayTitle(title) {
    return this.truncateByBytes(title, 24);
  },

  // 显示内容（最多58字符，29个中文）
  displayContent(content) {
    return this.truncateByBytes(content, 58);
  },

  // 截断文本（兼容旧版）
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

  // 计算显示宽度（中文/全角/Emoji 计 2，英文/半角计 1）
  getCharLength(str) {
    if (!str) return 0;

    // 优先使用 Intl.Segmenter 进行字素簇级分割
    let segments;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
        segments = Array.from(segmenter.segment(str), seg => seg.segment);
      } catch (e) {
        segments = Array.from(str);
      }
    } else {
      segments = Array.from(str);
    }

    let length = 0;
    for (const segment of segments) {
      length += this.getSegmentWidth(segment);
    }

    return length;
  }

  // [已废弃] limitInputLength 函数已移除
  // 输入不再限制长度，仅在显示时使用 truncateByBytes/displayTitle/displayContent
};