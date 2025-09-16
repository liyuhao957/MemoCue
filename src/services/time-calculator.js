/**
 * 时间计算服务
 * 负责各种调度类型的下次推送时间计算
 * 从 scheduler.js 中拆分出来以满足函数行数限制
 */

const { parseExpression } = require('cron-parser');
const { SCHEDULER } = require('../config/constants');

class TimeCalculator {
  /**
   * 计算每日推送的下次时间
   * @param {Array} times - 时间数组 ['HH:MM']
   * @returns {Date|null}
   */
  static calculateDaily(times) {
    if (!times || times.length === 0) return null;

    const now = new Date();
    const today = new Date(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const possibleTimes = [];

    times.forEach(time => {
      const [hours, minutes] = time.split(':').map(Number);

      const todayTime = new Date(today);
      todayTime.setHours(hours, minutes, 0, 0);
      if (todayTime > now) {
        possibleTimes.push(todayTime);
      }

      const tomorrowTime = new Date(tomorrow);
      tomorrowTime.setHours(hours, minutes, 0, 0);
      possibleTimes.push(tomorrowTime);
    });

    return possibleTimes.length > 0
      ? new Date(Math.min(...possibleTimes))
      : null;
  }

  /**
   * 计算每周推送的下次时间
   * @param {Array} weekDays - 星期数组 [0-6]
   * @param {String} time - 时间 'HH:MM'
   * @returns {Date|null}
   */
  static calculateWeekly(weekDays, time) {
    if (!weekDays || weekDays.length === 0 || !time) return null;

    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);

    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);
      checkDate.setHours(hours, minutes, 0, 0);

      if (weekDays.includes(checkDate.getDay()) && checkDate > now) {
        return checkDate;
      }
    }

    return null;
  }

  /**
   * 计算每月推送的下次时间
   * @param {Array} days - 日期数组 [1-31]
   * @param {String} time - 时间 'HH:MM'
   * @returns {Date|null}
   */
  static calculateMonthly(days, time) {
    if (!days || days.length === 0 || !time) return null;

    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);

    const possibleDates = [];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 检查当月
    days.forEach(day => {
      const date = new Date(currentYear, currentMonth, day, hours, minutes, 0, 0);
      if (date > now && date.getMonth() === currentMonth) {
        possibleDates.push(date);
      }
    });

    // 检查下个月
    if (possibleDates.length === 0) {
      const nextMonth = (currentMonth + 1) % 12;
      const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear;

      days.forEach(day => {
        const date = new Date(nextYear, nextMonth, day, hours, minutes, 0, 0);
        if (date.getMonth() === nextMonth) {
          possibleDates.push(date);
        }
      });
    }

    return possibleDates.length > 0
      ? new Date(Math.min(...possibleDates))
      : null;
  }

  /**
   * 计算间隔推送的下次时间
   * @param {Number} interval - 间隔（分钟）
   * @param {Date} lastPushAt - 上次推送时间
   * @returns {Date|null}
   */
  static calculateInterval(interval, lastPushAt) {
    if (!interval || interval <= 0) return null;

    const baseTime = lastPushAt ? new Date(lastPushAt) : new Date();
    const nextTime = new Date(baseTime);
    nextTime.setMinutes(nextTime.getMinutes() + interval);

    return nextTime > new Date() ? nextTime : new Date(Date.now() + interval * 60000);
  }

  /**
   * 计算工作日推送的下次时间
   * @param {Array} times - 时间数组 ['HH:MM']
   * @returns {Date|null}
   */
  static calculateWorkdays(times) {
    if (!times || times.length === 0) return null;

    const now = new Date();

    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);

      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const dateTime = new Date(checkDate);
          dateTime.setHours(hours, minutes, 0, 0);

          if (dateTime > now) {
            return dateTime;
          }
        }
      }
    }

    return null;
  }

  /**
   * 计算周末推送的下次时间
   * @param {Array} times - 时间数组 ['HH:MM']
   * @returns {Date|null}
   */
  static calculateWeekend(times) {
    if (!times || times.length === 0) return null;

    const now = new Date();

    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);

      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const dateTime = new Date(checkDate);
          dateTime.setHours(hours, minutes, 0, 0);

          if (dateTime > now) {
            return dateTime;
          }
        }
      }
    }

    return null;
  }

  /**
   * 计算Cron表达式的下次时间
   * @param {String} cronExpression - Cron表达式
   * @returns {Date|null}
   */
  static calculateCron(cronExpression) {
    if (!cronExpression) return null;

    try {
      const options = {
        currentDate: new Date(),
        tz: SCHEDULER.CRON_TIMEZONE
      };

      const interval = parseExpression(cronExpression, options);
      return interval.next().toDate();
    } catch (error) {
      console.error('Cron表达式解析失败:', error);
      return null;
    }
  }

  /**
   * 计算自定义推送的下次时间
   * @param {Array} dates - 日期时间数组 ['YYYY-MM-DD HH:MM']
   * @returns {Date|null}
   */
  static calculateCustom(dates) {
    if (!dates || dates.length === 0) return null;

    const now = new Date();
    const futureDates = dates
      .map(dateStr => new Date(dateStr))
      .filter(date => date > now)
      .sort((a, b) => a - b);

    return futureDates.length > 0 ? futureDates[0] : null;
  }
}

module.exports = TimeCalculator;