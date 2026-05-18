#!/bin/bash
# ================================================================
# 数据库自动备份脚本
# 每次执行任务前先执行此脚本进行备份
# ================================================================

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 备份目录
BACKUP_DIR="$SCRIPT_DIR/backups"
mkdir -p "$BACKUP_DIR"

# 时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Docker 数据库连接信息
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="inventory_system"
DB_USER="postgres"
DB_PASSWORD="junyuan123"

# 备份文件名
BACKUP_FILE="$BACKUP_DIR/inventory_system_backup_${TIMESTAMP}.sql"

# 执行备份 (使用 Docker 容器内的 pg_dump 避免版本不匹配)
echo "🔄 正在备份数据库 $DB_NAME 到 $BACKUP_FILE ..."
docker exec -i inventory_db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE"

# 压缩备份文件
gzip -f "$BACKUP_FILE"

echo "✅ 备份完成: ${BACKUP_FILE}.gz"

# 只保留最近 10 个备份，删除旧的
ls -t "$BACKUP_DIR"/inventory_system_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

# 显示备份列表
echo "📦 现有备份文件:"
ls -lh "$BACKUP_DIR"/inventory_system_backup_*.sql.gz 2>/dev/null | tail -5
