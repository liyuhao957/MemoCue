#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// 数据目录
const DATA_DIR = process.env.DATA_DIR || './data';

// 默认分类
const defaultCategories = [
  {
    id: 'default',
    name: '默认',
    icon: '📋',
    color: '#6B7280',
    sortOrder: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'work',
    name: '工作',
    icon: '💼',
    color: '#3B82F6',
    sortOrder: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: 'personal',
    name: '个人',
    icon: '👤',
    color: '#10B981',
    sortOrder: 2,
    createdAt: new Date().toISOString()
  },
  {
    id: 'important',
    name: '重要',
    icon: '⭐',
    color: '#EF4444',
    sortOrder: 3,
    createdAt: new Date().toISOString()
  }
];

async function initData() {
  try {
    console.log('🚀 开始初始化数据...');

    // 创建数据目录
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'logs'), { recursive: true });
    console.log('✅ 数据目录已创建');

    // 初始化任务文件
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    try {
      await fs.access(tasksFile);
      console.log('⏭️  tasks.json 已存在，跳过');
    } catch {
      await fs.writeFile(tasksFile, JSON.stringify([], null, 2));
      console.log('✅ tasks.json 已创建');
    }

    // 初始化设备文件
    const devicesFile = path.join(DATA_DIR, 'devices.json');
    try {
      await fs.access(devicesFile);
      console.log('⏭️  devices.json 已存在，跳过');
    } catch {
      await fs.writeFile(devicesFile, JSON.stringify([], null, 2));
      console.log('✅ devices.json 已创建');
    }

    // 初始化分类文件
    const categoriesFile = path.join(DATA_DIR, 'categories.json');
    try {
      await fs.access(categoriesFile);
      console.log('⏭️  categories.json 已存在，跳过');
    } catch {
      await fs.writeFile(categoriesFile, JSON.stringify(defaultCategories, null, 2));
      console.log('✅ categories.json 已创建（含默认分类）');
    }

    // 生成 .env 文件
    const envFile = path.join(process.cwd(), '.env');
    try {
      await fs.access(envFile);
      console.log('⏭️  .env 文件已存在');
    } catch {
      const randomSecret = crypto.randomBytes(32).toString('hex');

      const envContent = `# MemoCue 配置文件

# 服务器端口
PORT=3000

# 数据目录
DATA_DIR=./data

# 时区设置
TZ=Asia/Shanghai

# 日志级别
LOG_LEVEL=info

# 最大重试次数
MAX_RETRY_COUNT=3

# 加密密钥（用于加密设备配置）
ENCRYPTION_SECRET=${randomSecret}`;

      await fs.writeFile(envFile, envContent);
      console.log('✅ .env 文件已创建');
    }

    console.log('');
    console.log('✨ 数据初始化完成！');
    console.log('');
    console.log('下一步：');
    console.log('1. 运行 npm start 启动服务器');
    console.log('2. 访问 http://localhost:3000');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行初始化
initData();