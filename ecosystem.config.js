/**
 * PM2 配置文件
 * 用于生产环境部署
 *
 * 使用方法:
 * 1. 安装 PM2: npm install -g pm2
 * 2. 启动服务: pm2 start ecosystem.config.js
 * 3. 查看状态: pm2 status
 * 4. 查看日志: pm2 logs memocue
 * 5. 重启服务: pm2 restart memocue
 * 6. 停止服务: pm2 stop memocue
 */

module.exports = {
  apps: [{
    // 应用名称
    name: 'memocue',

    // 入口文件
    script: './src/server.js',

    // 工作目录
    cwd: './',

    // 实例数量（重要：必须为1以避免调度器重复执行）
    instances: 1,

    // 执行模式（fork模式，不使用cluster）
    exec_mode: 'fork',

    // 自动重启
    autorestart: true,

    // 监听文件变化（生产环境建议关闭）
    watch: false,

    // 忽略监听的文件
    ignore_watch: ['node_modules', 'data', 'logs', '.git'],

    // 最大内存限制
    max_memory_restart: '500M',

    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      TZ: 'Asia/Shanghai',
      // 子目录部署路径（如果需要）
      BASE_PATH: '',
      // 日志级别
      LOG_LEVEL: 'info',
      // 日志保留天数
      LOG_RETENTION_DAYS: 7
    },

    // 开发环境配置
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'debug'
    },

    // 子目录部署环境配置
    env_subdirectory: {
      NODE_ENV: 'production',
      PORT: 3000,
      BASE_PATH: '/memocue',
      TZ: 'Asia/Shanghai',
      LOG_LEVEL: 'info',
      LOG_RETENTION_DAYS: 7
    },

    // 错误日志文件
    error_file: './logs/pm2/error.log',

    // 输出日志文件
    out_file: './logs/pm2/out.log',

    // 日志日期格式
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // 合并日志
    merge_logs: true,

    // 最小运行时间（避免频繁重启）
    min_uptime: '10s',

    // 进程名称
    name_prefix: 'memocue',

    // 等待应用启动的时间
    wait_ready: true,
    listen_timeout: 3000,

    // 停止信号
    kill_timeout: 15000, // 15秒优雅关闭时间

    // ⚠️ 注意：以下字段不是标准 PM2 配置，仅作文档说明用途
    // 实际部署脚本应该：
    // 1. 在 deploy 配置段中设置（见下方 deploy 部分）
    // 2. 或使用外部 CI/CD 工具（如 Jenkins、GitLab CI）
    // 3. 或通过 shell 脚本手动执行

    // pre_setup: 'npm install --production', // 文档示例：安装依赖

    // health_check 示例：实际健康检查建议使用
    // 1. PM2 Plus 监控服务
    // 2. 外部监控工具（如 Zabbix、Prometheus）
    // 3. 自定义脚本定期检查 /health 端点
    // health_check_url: 'http://localhost:3000/health', // 文档示例

    // 进程间通信
    instance_var: 'INSTANCE_ID',

    // 是否在 Cron 重启时不重启
    cron_restart: '0 3 * * *', // 每天凌晨3点重启

    // Node.js 参数
    node_args: '--max-old-space-size=256'
  }],

  // 部署配置
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/memocue.git',
      path: '/var/www/memocue',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server"',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};