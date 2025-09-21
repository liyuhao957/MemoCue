# MemoCue 部署指南

本文档提供了 MemoCue 在 Linux 服务器上的完整部署指南，支持独立部署和子路径部署两种方式。

## 📋 系统要求

- **操作系统**: Linux (Ubuntu/Debian 推荐)
- **Node.js**: >= 18.0.0
- **NPM**: >= 7.0.0
- **Nginx**: 1.18+ (可选，用于反向代理)
- **PM2**: 进程管理工具

## 🚀 快速部署（独立服务）

### 1. 准备环境

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (如未安装)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 验证安装
node -v  # 应显示 v18.x.x 或更高
npm -v   # 应显示 7.x.x 或更高
pm2 -v   # 应显示 PM2 版本
```

### 2. 下载项目

```bash
# 创建应用目录
sudo mkdir -p /opt/memocue
sudo chown $USER:$USER /opt/memocue
cd /opt/memocue

# 从 GitHub 克隆
git clone https://github.com/liyuhao957/MemoCue.git .

```

### 3. 安装和配置

```bash
# 安装依赖
npm install --production

# 初始化数据目录
npm run data:init

# 创建环境配置
cat > .env << EOF
# 基础配置
PORT=3000                    # 服务端口
BASE_PATH=                   # 留空则部署在根路径
TZ=Asia/Shanghai            # 时区设置

# 安全配置
ENCRYPTION_SECRET=your-32-chars-random-secret-key-here  # 32个字符的加密密钥

# 日志配置
LOG_LEVEL=info              # 日志级别: debug, info, warn, error
DATA_DIR=./data             # 数据存储目录
EOF

# 生成并设置加密密钥（重要！）
# 方法1：生成随机密钥
openssl rand -hex 16
# 将上面生成的32个字符的密钥复制，手动替换 .env 文件中的 your-32-chars-random-secret-key-here

# 方法2：自动替换（Linux）
KEY=$(openssl rand -hex 16)
sed -i "s/your-32-chars-random-secret-key-here/$KEY/" .env

# 方法3：自动替换（macOS）
KEY=$(openssl rand -hex 16)
sed -i '' "s/your-32-chars-random-secret-key-here/$KEY/" .env
```

### 4. 启动服务

```bash
# 使用 PM2 启动
pm2 start src/server.js --name memocue --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 执行上面命令后显示的 sudo 命令
```

### 5. 验证部署

```bash
# 检查服务状态
pm2 status memocue

# 查看日志
pm2 logs memocue --lines 20

# 测试 API
curl http://localhost:3000/health

# 浏览器访问
# http://your-server-ip:3000
```

## 🌐 Nginx 反向代理部署（推荐）

### 方式一：独立域名/端口

```nginx
# /etc/nginx/sites-available/memocue
server {
    listen 80;
    server_name memocue.example.com;  # 或使用 IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket 和 SSE 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;

        # 标准代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 86400s;

        # 文件上传限制
        client_max_body_size 10M;
    }
}
```

### 方式二：子路径部署

如果需要部署在子路径下（如 `/memocue`）：

1. **修改 .env 配置**：
```bash
BASE_PATH=/memocue
PORT=3001  # 使用不同端口避免冲突
```

2. **Nginx 配置**：
```nginx
# 添加到现有 server 块中
server {
    listen 80;
    server_name your-server-ip;

    # ... 其他配置 ...

    # MemoCue 子路径
    location /memocue/ {
        proxy_pass http://127.0.0.1:3001/memocue/;
        proxy_http_version 1.1;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;

        # 标准头部
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_set_header Connection "upgrade";
        proxy_set_header Upgrade $http_upgrade;

        client_max_body_size 10M;
    }

    # 自动重定向
    location = /memocue {
        return 301 /memocue/;
    }
}
```

3. **启用配置**：
```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/memocue /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

## 🔐 HTTPS 配置（可选）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d memocue.example.com

# 自动续期
sudo certbot renew --dry-run
```


## 🔧 故障排查

### 常见问题

#### 1. 端口被占用
```bash
# 检查端口占用
sudo netstat -tlnp | grep 3000

# 修改 .env 中的 PORT 配置为其他端口
```

#### 2. PM2 进程频繁重启
```bash
# 查看错误日志
pm2 logs memocue --err

# 检查内存使用
pm2 monit

# 查看详细信息
pm2 info memocue
```

#### 3. 无法访问服务
```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 3000/tcp  # 如果使用 ufw

# 检查 iptables
sudo iptables -L -n | grep 3000
```

#### 4. SSE 连接断开
```bash
# 增加 Nginx 超时时间
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

### 日志位置

- **应用日志**: `/opt/memocue/data/logs/`
- **PM2 日志**: `~/.pm2/logs/`
- **Nginx 日志**: `/var/log/nginx/`

## 📊 监控和维护

### 日常维护命令

```bash
# 查看状态
pm2 status

# 重启服务
pm2 restart memocue

# 实时日志
pm2 logs memocue --follow

# 监控资源
pm2 monit

# 备份数据
tar -czf memocue-backup-$(date +%Y%m%d).tar.gz /opt/memocue/data
```

### 更新部署

```bash
cd /opt/memocue

# 备份当前版本
cp -r . ../memocue-backup-$(date +%Y%m%d)

# 拉取更新
git pull

# 安装新依赖
npm install --production

# 重启服务
pm2 restart memocue
```

### 性能优化

1. **启用集群模式**（多核服务器）：
```bash
pm2 start src/server.js -i max --name memocue
```

2. **设置内存限制**：
```bash
pm2 start src/server.js --name memocue --max-memory-restart 500M
```

3. **启用日志轮转**：
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🔄 备份与恢复

### 备份策略

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/memocue"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/memocue-$DATE.tar.gz \
  /opt/memocue/data \
  /opt/memocue/.env

# 保留最近7天的备份
find $BACKUP_DIR -name "memocue-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/memocue-$DATE.tar.gz"
```

添加到 crontab：
```bash
# 每天凌晨2点备份
0 2 * * * /path/to/backup.sh
```

### 恢复数据

```bash
# 停止服务
pm2 stop memocue

# 恢复备份（替换 YYYYMMDD 为实际日期）
tar -xzf /backup/memocue/memocue-YYYYMMDD.tar.gz -C /

# 启动服务
pm2 start memocue
```

## 📝 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `BASE_PATH` | 基础路径（子路径部署时使用） | 空 |
| `TZ` | 时区 | Asia/Shanghai |
| `ENCRYPTION_SECRET` | 加密密钥（32个字符） | 必填 |
| `LOG_LEVEL` | 日志级别 | info |
| `DATA_DIR` | 数据目录 | ./data |

## 🔒 安全建议

1. **修改默认端口**：不使用默认的 3000 端口
2. **设置强密钥**：使用随机生成的 32 个字符的加密密钥
3. **限制访问**：使用防火墙限制访问来源
4. **启用 HTTPS**：生产环境务必使用 HTTPS
5. **定期备份**：设置自动备份任务
6. **监控日志**：定期检查错误日志
7. **及时更新**：关注安全更新并及时升级