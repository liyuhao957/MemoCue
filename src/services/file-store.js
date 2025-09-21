const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');
const writeFileAtomic = require('write-file-atomic');

class FileStore {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.cache = new Map();
    this.TTL = 60000; // 1分钟缓存
    this.initPromise = this.init();
  }

  async init() {
    // 确保数据目录存在
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'logs'), { recursive: true });
  }

  async ensureInit() {
    await this.initPromise;
  }

  getFilePath(filename) {
    return path.join(this.dataDir, filename);
  }

  // 读取JSON文件（带缓存）
  async readJson(filename, defaultValue = null) {
    await this.ensureInit();
    const filepath = this.getFilePath(filename);

    // 检查缓存
    const now = Date.now();
    const cached = this.cache.get(filepath);
    if (cached && now - cached.time < this.TTL) {
      return cached.data;
    }

    try {
      const data = await fs.readFile(filepath, 'utf8');
      const parsed = JSON.parse(data);

      // 更新缓存
      this.cache.set(filepath, { time: now, data: parsed });
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，返回默认值
        if (defaultValue !== null) {
          await this.writeJson(filename, defaultValue);
          return defaultValue;
        }
        return null;
      }
      throw error;
    }
  }

  // 写入JSON文件（原子写入+文件锁）
  async writeJson(filename, data) {
    await this.ensureInit();
    const filepath = this.getFilePath(filename);
    const tempPath = `${filepath}.tmp`;

    // 获取文件锁
    let release = null;
    try {
      // 如果文件存在，获取锁（增强重试机制）
      try {
        await fs.access(filepath);
        release = await lockfile.lock(filepath, {
          retries: {
            retries: 20,         // 增加重试次数
            minTimeout: 100,     // 最小重试间隔
            maxTimeout: 1000,    // 最大重试间隔
            randomize: true      // 随机化重试间隔，避免竞争
          },
          stale: 10000,          // 锁过期时间 10秒
          updateDelay: 100       // 更新锁的延迟
        });
      } catch (err) {
        // 文件不存在，无需锁
      }

      // 原子写入
      await writeFileAtomic(filepath, JSON.stringify(data, null, 2));

      // 清除缓存
      this.cache.delete(filepath);

    } finally {
      if (release) {
        await release();
      }
    }
  }

  // 更新JSON文件中的部分数据
  async updateJson(filename, updateFn, defaultValue = {}) {
    await this.ensureInit();
    const filepath = this.getFilePath(filename);

    let release = null;
    try {
      // 获取文件锁（增强重试机制）
      try {
        await fs.access(filepath);
        release = await lockfile.lock(filepath, {
          retries: {
            retries: 20,         // 增加重试次数
            minTimeout: 100,     // 最小重试间隔
            maxTimeout: 1000,    // 最大重试间隔
            randomize: true      // 随机化重试间隔，避免竞争
          },
          stale: 10000,          // 锁过期时间 10秒
          updateDelay: 100       // 更新锁的延迟
        });
      } catch (err) {
        // 文件不存在
      }

      // 直接读取文件，避免调用 readJson（防止锁重入和缓存问题）
      let currentData;
      try {
        const data = await fs.readFile(filepath, 'utf8');
        currentData = JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // 文件不存在，使用默认值
          currentData = defaultValue;
        } else if (error instanceof SyntaxError) {
          // JSON 解析失败，使用默认值
          currentData = defaultValue;
        } else {
          throw error;
        }
      }

      // 应用更新
      const newData = await updateFn(currentData);

      // 写回文件
      await writeFileAtomic(filepath, JSON.stringify(newData, null, 2));

      // 清除缓存
      this.cache.delete(filepath);

      return newData;
    } finally {
      if (release) {
        await release();
      }
    }
  }

  // 删除文件
  async deleteFile(filename) {
    await this.ensureInit();
    const filepath = this.getFilePath(filename);

    try {
      await fs.unlink(filepath);
      this.cache.delete(filepath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // 列出目录中的文件
  async listFiles(subdir = '') {
    await this.ensureInit();
    const dirPath = subdir ? path.join(this.dataDir, subdir) : this.dataDir;

    try {
      const files = await fs.readdir(dirPath);
      return files.filter(f => !f.startsWith('.'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取文件统计信息
  async getFileStats(filename) {
    await this.ensureInit();
    const filepath = this.getFilePath(filename);

    try {
      return await fs.stat(filepath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

// 导出单例
module.exports = new FileStore(process.env.DATA_DIR || './data');