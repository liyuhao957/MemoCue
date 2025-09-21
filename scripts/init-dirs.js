#!/usr/bin/env node

/**
 * 目录初始化脚本
 * 确保所有必要的目录存在并具有正确的权限
 */

const fs = require('fs');
const path = require('path');

// 需要创建的目录列表
const directories = [
  // 数据目录
  'data',
  'data/logs',
  'data/locks',
  'data/backup',

  // PM2 日志目录
  'logs',
  'logs/pm2',

  // 临时文件目录
  'temp'
];

// 项目根目录
const projectRoot = path.join(__dirname, '..');

console.log('📁 初始化项目目录结构...\n');

// 创建目录
directories.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);

  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
      console.log(`✅ 创建目录: ${dir}`);
    } else {
      console.log(`📌 目录已存在: ${dir}`);
    }

    // 设置正确的权限
    fs.chmodSync(fullPath, 0o755);

  } catch (error) {
    console.error(`❌ 创建目录失败 ${dir}: ${error.message}`);
    process.exit(1);
  }
});

// 创建 .gitignore 文件（如果需要）
const gitignorePaths = [
  { path: 'data/.gitignore', content: '*\n!.gitignore\n!README.md\n' },
  { path: 'logs/.gitignore', content: '*\n!.gitignore\n' },
  { path: 'temp/.gitignore', content: '*\n!.gitignore\n' }
];

gitignorePaths.forEach(({ path: gitignorePath, content }) => {
  const fullPath = path.join(projectRoot, gitignorePath);

  if (!fs.existsSync(fullPath)) {
    try {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 创建 .gitignore: ${gitignorePath}`);
    } catch (error) {
      console.error(`⚠️  创建 .gitignore 失败: ${gitignorePath}`);
    }
  }
});

// 创建 README 文件
const readmePaths = [
  {
    path: 'data/README.md',
    content: '# 数据目录\n\n此目录包含应用程序的所有数据文件：\n\n- `tasks.json` - 任务数据\n- `devices.json` - 设备配置\n- `categories.json` - 分类数据\n- `logs/` - 执行日志\n- `locks/` - 进程锁文件\n- `backup/` - 数据备份\n\n⚠️ **重要**：定期备份此目录！\n'
  }
];

readmePaths.forEach(({ path: readmePath, content }) => {
  const fullPath = path.join(projectRoot, readmePath);

  if (!fs.existsSync(fullPath)) {
    try {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 创建 README: ${readmePath}`);
    } catch (error) {
      console.error(`⚠️  创建 README 失败: ${readmePath}`);
    }
  }
});

console.log('\n✨ 目录初始化完成！');

// 检查和报告权限问题
console.log('\n🔍 检查目录权限...');

directories.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);

  try {
    // 测试读写权限
    const testFile = path.join(fullPath, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`✅ ${dir} - 读写权限正常`);
  } catch (error) {
    console.error(`❌ ${dir} - 权限问题: ${error.message}`);
  }
});

console.log('\n📋 初始化总结:');
console.log(`- 项目根目录: ${projectRoot}`);
console.log(`- 检查的目录数: ${directories.length}`);
console.log(`- Node.js 版本: ${process.version}`);
console.log(`- 当前用户: ${process.env.USER || process.env.USERNAME || 'unknown'}`);
console.log('\n💡 提示: 在部署前运行 `npm run init:dirs` 确保目录结构正确');

// 如果作为模块导出
if (require.main !== module) {
  module.exports = {
    initDirectories: () => {
      // 可以在其他脚本中调用
      console.log('Initializing directories...');
    }
  };
}