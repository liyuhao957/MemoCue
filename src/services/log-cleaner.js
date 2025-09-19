/**
 * 日志清理服务
 * 负责清理系统日志文件中的旧记录
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { createReadStream, createWriteStream } = require('fs');

class LogCleaner {
  constructor() {
    // 保留天数：确保为正整数，默认2天
    const days = parseInt(process.env.LOG_RETENTION_DAYS, 10);
    this.retentionDays = Number.isFinite(days) && days > 0 ? days : 2;
    this.logsDir = path.join(process.env.DATA_DIR || './data', 'logs');
  }

  /**
   * 清理文件日志（app.log 和 error.log）
   * 删除超过保留天数的日志行
   * @returns {Object} 清理统计信息
   */
  async cleanFileLogs() {
    const files = ['app.log', 'error.log'];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    // 并发处理所有文件
    const results = await Promise.allSettled(
      files.map(filename => this.cleanLogFile(filename, cutoffDate))
    );

    // 汇总统计信息
    const stats = {
      totalFiles: files.length,
      successCount: 0,
      failedCount: 0,
      totalLinesKept: 0,
      totalLinesRemoved: 0,
      details: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        stats.successCount++;
        stats.totalLinesKept += result.value.keptLines;
        stats.totalLinesRemoved += result.value.removedLines;
        stats.details.push(result.value);
      } else {
        stats.failedCount++;
        console.error(`Failed to clean ${files[index]}:`, result.reason?.message);
        stats.details.push({
          filename: files[index],
          error: result.reason?.message,
          keptLines: 0,
          removedLines: 0
        });
      }
    });

    return stats;
  }

  /**
   * 清理单个日志文件
   * @param {string} filename - 日志文件名
   * @param {Date} cutoffDate - 截止日期
   */
  async cleanLogFile(filename, cutoffDate) {
    const filePath = path.join(this.logsDir, filename);
    const tempPath = `${filePath}.tmp`;

    try {
      // 检查文件是否存在
      await fs.access(filePath);
    } catch {
      // 文件不存在，返回跳过信息，避免上层处理时报错
      return {
        filename,
        keptLines: 0,
        removedLines: 0,
        skipped: true,
        error: 'File not found'
      };
    }

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(filePath, { encoding: 'utf8' });
      const writeStream = createWriteStream(tempPath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity
      });

      let keptLines = 0;
      let removedLines = 0;

      rl.on('line', (line) => {
        try {
          // 尝试解析日志行中的时间戳
          const timestampMatch = line.match(/"timestamp":"(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
          if (timestampMatch) {
            const logDate = new Date(timestampMatch[1].replace(' ', 'T'));
            if (logDate >= cutoffDate) {
              writeStream.write(line + '\n');
              keptLines++;
            } else {
              removedLines++;
            }
          } else {
            // 无法解析时间戳的行，保留
            writeStream.write(line + '\n');
            keptLines++;
          }
        } catch (error) {
          // 解析错误，保留该行
          writeStream.write(line + '\n');
          keptLines++;
        }
      });

      // 流错误处理，避免未捕获异常
      rl.on('error', reject);
      readStream.on('error', reject);
      writeStream.on('error', reject);

      rl.on('close', async () => {
        writeStream.end();
        writeStream.on('finish', async () => {
          try {
            // 如果有删除的行，替换原文件
            if (removedLines > 0) {
              await fs.rename(tempPath, filePath);
            } else {
              // 没有删除任何行，删除临时文件
              await fs.unlink(tempPath).catch(() => {});
            }
            resolve({ filename, keptLines, removedLines });
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  /**
   * 清理残留的临时文件
   * @returns {Object} 清理统计
   */
  async cleanTempFiles() {
    const stats = {
      checked: 0,
      removed: 0,
      failed: 0
    };

    try {
      const files = await fs.readdir(this.logsDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      stats.checked = tempFiles.length;

      if (tempFiles.length === 0) {
        return stats;
      }

      // 只清理超过1小时的临时文件
      const oneHourAgo = Date.now() - 3600000;

      for (const file of tempFiles) {
        const filePath = path.join(this.logsDir, file);
        try {
          const fileStat = await fs.stat(filePath);
          if (fileStat.mtime.getTime() < oneHourAgo) {
            await fs.unlink(filePath);
            stats.removed++;
          }
        } catch (error) {
          // 静默处理单个文件的错误
          stats.failed++;
        }
      }
    } catch (error) {
      // 目录不存在等错误
      console.error('Clean temp files failed:', error.message);
    }

    return stats;
  }

  /**
   * 执行所有清理任务
   * @returns {Object} 清理统计信息
   */
  async cleanAll() {
    const startTime = Date.now();

    // 并行执行清理任务
    const [fileStats, tempStats] = await Promise.allSettled([
      this.cleanFileLogs(),
      this.cleanTempFiles()
    ]);

    // logs.json 由 log-store.js 自动维护在500条以内，无需额外清理
    const summary = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      retentionDays: this.retentionDays,
      fileLogs: fileStats.status === 'fulfilled' ? fileStats.value : { error: fileStats.reason?.message },
      tempFiles: tempStats.status === 'fulfilled' ? tempStats.value : { error: tempStats.reason?.message }
    };

    return summary;
  }

  /**
   * 手动触发清理（用于测试）
   * @returns {Object} 清理统计信息
   */
  async forceClean() {
    const results = await this.cleanAll();
    return results;
  }

  /**
   * 获取日志文件统计信息（不执行清理）
   * @returns {Object} 文件统计信息
   */
  async getLogStats() {
    const files = ['app.log', 'error.log'];
    const stats = {
      files: [],
      totalSize: 0
    };

    for (const filename of files) {
      const filePath = path.join(this.logsDir, filename);
      try {
        const fileStat = await fs.stat(filePath);
        stats.files.push({
          name: filename,
          size: fileStat.size,
          sizeKB: (fileStat.size / 1024).toFixed(2),
          modified: fileStat.mtime.toISOString()
        });
        stats.totalSize += fileStat.size;
      } catch (error) {
        stats.files.push({
          name: filename,
          error: 'File not found'
        });
      }
    }

    stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
    return stats;
  }
}

module.exports = new LogCleaner();
