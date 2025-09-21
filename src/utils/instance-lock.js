/**
 * 实例锁管理器
 * 用于确保只有一个进程实例运行调度器
 * 防止 PM2 多实例或多进程环境下的任务重复执行
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./logger');

class InstanceLock {
  constructor() {
    // 优先使用持久化目录，避免系统重启后清理
    // 支持通过环境变量自定义锁文件路径
    this.lockDir = process.env.LOCK_FILE_DIR ||
                    path.join(__dirname, '..', '..', 'data', 'locks') ||
                    os.tmpdir();

    this.lockFile = path.join(this.lockDir, 'memocue-scheduler.lock');
    this.isLockHolder = false;
    this.lockCheckInterval = null;
    this.pid = process.pid;
    this.hostname = os.hostname();
    this.initialized = false;

    // 注意：构造函数中不能使用 async，需要在外部调用 init
    logger.info('Instance lock initialized', { lockFile: this.lockFile });
  }

  /**
   * 初始化锁管理器（确保目录存在）
   */
  async init() {
    if (this.initialized) return;

    await this.ensureLockDir();
    this.initialized = true;
  }

  /**
   * 确保锁目录存在
   */
  async ensureLockDir() {
    try {
      await fs.mkdir(this.lockDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create lock directory', {
        dir: this.lockDir,
        error: error.message
      });
    }
  }

  /**
   * 尝试获取调度器锁
   * @returns {Promise<boolean>} 是否成功获取锁
   */
  async acquireLock() {
    // 确保已初始化
    await this.init();

    try {
      // 检查是否存在锁文件
      let existingLock = null;
      try {
        const lockData = await fs.readFile(this.lockFile, 'utf8');
        existingLock = JSON.parse(lockData);
      } catch (error) {
        // 锁文件不存在或无法读取，可以创建新锁
      }

      // 如果存在锁，检查持有者是否还活着
      if (existingLock) {
        const isAlive = await this.isProcessAlive(existingLock.pid);

        if (isAlive && existingLock.hostname === this.hostname) {
          // 锁持有者还活着，无法获取锁
          logger.info('Scheduler lock already held by another process', {
            holder: existingLock,
            current: { pid: this.pid, hostname: this.hostname }
          });
          return false;
        }

        // 锁持有者已经死亡或在不同机器，可以接管
        logger.info('Taking over stale scheduler lock', {
          oldHolder: existingLock,
          newHolder: { pid: this.pid, hostname: this.hostname }
        });
      }

      // 创建新的锁文件
      const lockData = {
        pid: this.pid,
        hostname: this.hostname,
        acquiredAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString()
      };

      await fs.writeFile(this.lockFile, JSON.stringify(lockData, null, 2));
      this.isLockHolder = true;

      // 启动心跳机制
      this.startHeartbeat();

      logger.info('Successfully acquired scheduler lock', lockData);
      return true;

    } catch (error) {
      logger.error('Failed to acquire scheduler lock', { error: error.message });
      return false;
    }
  }

  /**
   * 释放调度器锁
   */
  async releaseLock() {
    if (!this.isLockHolder) {
      return;
    }

    try {
      // 停止心跳
      this.stopHeartbeat();

      // 删除锁文件
      await fs.unlink(this.lockFile);
      this.isLockHolder = false;

      logger.info('Released scheduler lock', { pid: this.pid });
    } catch (error) {
      logger.error('Failed to release scheduler lock', { error: error.message });
    }
  }

  /**
   * 检查进程是否存活
   * @param {number} pid 进程ID
   * @returns {boolean} 进程是否存活
   */
  async isProcessAlive(pid) {
    try {
      // 发送信号0来检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 启动心跳机制
   * 定期更新锁文件的心跳时间
   */
  startHeartbeat() {
    // 每10秒更新一次心跳
    this.lockCheckInterval = setInterval(async () => {
      if (!this.isLockHolder) {
        this.stopHeartbeat();
        return;
      }

      try {
        const lockData = {
          pid: this.pid,
          hostname: this.hostname,
          acquiredAt: new Date().toISOString(),
          lastHeartbeat: new Date().toISOString()
        };

        await fs.writeFile(this.lockFile, JSON.stringify(lockData, null, 2));
      } catch (error) {
        logger.error('Failed to update lock heartbeat', { error: error.message });
      }
    }, 10000);
  }

  /**
   * 停止心跳机制
   */
  stopHeartbeat() {
    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval);
      this.lockCheckInterval = null;
    }
  }

  /**
   * 检查是否持有锁
   * @returns {boolean}
   */
  hasLock() {
    return this.isLockHolder;
  }

  /**
   * 获取锁信息
   * @returns {Promise<object|null>} 锁信息或null
   */
  async getLockInfo() {
    try {
      const lockData = await fs.readFile(this.lockFile, 'utf8');
      return JSON.parse(lockData);
    } catch (error) {
      return null;
    }
  }
}

// 导出单例
module.exports = new InstanceLock();