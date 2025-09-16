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
        app.taskForm.schedule.day = 15;
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
        return `每${schedule.interval}个月的${schedule.day}日 ${schedule.time}`;
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
  }
};