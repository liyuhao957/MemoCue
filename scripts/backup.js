#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// 配置
const DATA_DIR = process.env.DATA_DIR || './data';
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 30; // 保留最近30个备份

async function backup() {
  try {
    console.log('🔄 开始备份数据...');

    // 创建备份目录
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // 创建备份目录
    await fs.mkdir(backupPath);

    // 备份文件列表
    const filesToBackup = ['tasks.json', 'devices.json', 'categories.json'];

    // 复制文件
    for (const file of filesToBackup) {
      const srcPath = path.join(DATA_DIR, file);
      const destPath = path.join(backupPath, file);

      try {
        await fs.copyFile(srcPath, destPath);
        console.log(`✅ 已备份: ${file}`);
      } catch (error) {
        console.log(`⚠️  跳过不存在的文件: ${file}`);
      }
    }

    // 创建备份元数据
    const metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      files: filesToBackup
    };

    await fs.writeFile(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✅ 备份完成: ${backupName}`);

    // 清理旧备份
    await cleanOldBackups();

  } catch (error) {
    console.error('❌ 备份失败:', error.message);
    process.exit(1);
  }
}

async function cleanOldBackups() {
  try {
    const backups = await fs.readdir(BACKUP_DIR);
    const backupDirs = backups
      .filter(name => name.startsWith('backup-'))
      .sort()
      .reverse();

    if (backupDirs.length > MAX_BACKUPS) {
      const toDelete = backupDirs.slice(MAX_BACKUPS);

      for (const dir of toDelete) {
        const dirPath = path.join(BACKUP_DIR, dir);
        await fs.rm(dirPath, { recursive: true });
        console.log(`🗑️  已删除旧备份: ${dir}`);
      }
    }

    console.log(`📦 当前备份数: ${Math.min(backupDirs.length, MAX_BACKUPS)}`);

  } catch (error) {
    console.warn('⚠️  清理旧备份失败:', error.message);
  }
}

// 执行备份
backup();