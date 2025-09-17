/**
 * 时间计算服务
 * 负责各种调度类型的下次推送时间计算
 * 从 scheduler.js 中拆分出来以满足函数行数限制
 */

const { parseExpression } = require('cron-parser');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { SCHEDULER } = require('../config/constants');

// 配置 dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

class TimeCalculator {
  /**
   * 计算每日推送的下次时间
   * @param {Array} times - 时间数组 ['HH:MM']
   * @returns {Date|null}
   */
  static calculateDaily(times) {
    if (!times || times.length === 0) return null;

    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);
    const today = now.startOf('day');
    const tomorrow = today.add(1, 'day');

    const possibleTimes = [];

    times.forEach(time => {
      const [hours, minutes] = time.split(':').map(Number);

      // 今天的时间
      const todayTime = today.hour(hours).minute(minutes).second(0).millisecond(0);
      if (todayTime.isAfter(now)) {
        possibleTimes.push(todayTime.toDate());
      }

      // 明天的时间
      const tomorrowTime = tomorrow.hour(hours).minute(minutes).second(0).millisecond(0);
      possibleTimes.push(tomorrowTime.toDate());
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

    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);
    const [hours, minutes] = time.split(':').map(Number);

    for (let i = 0; i <= 7; i++) {
      const checkDate = now.add(i, 'day').hour(hours).minute(minutes).second(0).millisecond(0);

      if (weekDays.includes(checkDate.day()) && checkDate.isAfter(now)) {
        return checkDate.toDate();
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

    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);
    const [hours, minutes] = time.split(':').map(Number);

    const possibleDates = [];

    // 检查当月
    days.forEach(day => {
      const date = now.date(day).hour(hours).minute(minutes).second(0).millisecond(0);
      if (date.isAfter(now) && date.date() === day) {
        possibleDates.push(date.toDate());
      }
    });

    // 检查下个月
    if (possibleDates.length === 0) {
      const nextMonth = now.add(1, 'month').startOf('month');
      days.forEach(day => {
        const date = nextMonth.date(day).hour(hours).minute(minutes).second(0).millisecond(0);
        if (date.date() === day) {
          possibleDates.push(date.toDate());
        }
      });
    }

    return possibleDates.length > 0
      ? new Date(Math.min(...possibleDates))
      : null;
  }

  /**
   * 计算每小时推送的下次时间
   * @param {Number} minute - 每小时的第几分钟
   * @param {Number} startHour - 开始时间（可选）
   * @param {Number} endHour - 结束时间（可选）
   * @returns {Date|null}
   */
  static calculateHourly(minute, startHour, endHour) {
    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);
    let nextTime = now.minute(minute).second(0).millisecond(0);

    // 如果当前时间已经过了这个分钟，移到下一个小时
    if (!nextTime.isAfter(now)) {
      nextTime = nextTime.add(1, 'hour');
    }

    // 如果有时间范围限制
    if (startHour !== undefined && startHour !== null &&
        endHour !== undefined && endHour !== null) {
      const currentHour = nextTime.hour();

      // 如果下次执行时间不在范围内
      if (currentHour < startHour || currentHour > endHour) {
        // 设置到下一个开始时间
        if (currentHour < startHour) {
          // 今天的开始时间
          nextTime = nextTime.hour(startHour).minute(minute).second(0).millisecond(0);
        } else {
          // 明天的开始时间
          nextTime = nextTime.add(1, 'day').hour(startHour).minute(minute).second(0).millisecond(0);
        }
      }
    }

    return nextTime.toDate();
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

    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);

    for (let i = 0; i <= 7; i++) {
      const checkDate = now.add(i, 'day').startOf('day');

      const dayOfWeek = checkDate.day();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const dateTime = checkDate.hour(hours).minute(minutes).second(0).millisecond(0);

          if (dateTime.isAfter(now)) {
            return dateTime.toDate();
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

    const tz = SCHEDULER.CRON_TIMEZONE;
    const now = dayjs().tz(tz);

    for (let i = 0; i <= 7; i++) {
      const checkDate = now.add(i, 'day').startOf('day');

      const dayOfWeek = checkDate.day();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const dateTime = checkDate.hour(hours).minute(minutes).second(0).millisecond(0);

          if (dateTime.isAfter(now)) {
            return dateTime.toDate();
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