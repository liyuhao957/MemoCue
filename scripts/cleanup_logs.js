#!/usr/bin/env node

/**
 * 清理旧日志文件，只保留最近7天的日志
 */

const fs = require('fs');
const path = require('path');

const logsPath = path.join(__dirname, '..', 'data', 'logs.json');

// 读取日志文件
let logs = [];
try {
  const data = fs.readFileSync(logsPath, 'utf-8');
  logs = JSON.parse(data);
} catch (error) {
  console.log('无法读取日志文件或文件为空');
  process.exit(0);
}

// 计算7天前的时间戳
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

// 过滤最近7天的日志
const recentLogs = logs.filter(log => {
  const logDate = new Date(log.timestamp);
  return logDate > sevenDaysAgo;
});

// 保存清理后的日志
fs.writeFileSync(logsPath, JSON.stringify(recentLogs, null, 2));

console.log(`日志清理完成：`);
console.log(`- 原始日志数量: ${logs.length}`);
console.log(`- 保留日志数量: ${recentLogs.length}`);
console.log(`- 删除日志数量: ${logs.length - recentLogs.length}`);