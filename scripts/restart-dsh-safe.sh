#!/bin/bash
# dsh-web 健康重启保护:
# 1. 记录重启前 health(3080 是否 200)
# 2. pm2 restart dsh-web
# 3. 等待就绪,验证 3080 返回 200
# 4. 失败:回滚 profile package.json 到最近备份 + 再次重启;仍失败则报告
# 用法:bash scripts/restart-dsh-safe.sh
set -u

URL="http://127.0.0.1:3080/"
PROFILE_DIR="$HOME/.dsh/profiles/web"
LOG="/tmp/dsh-restart-safe.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# 1. 健康记录
if curl -s -o /dev/null -m 5 "$URL"; then log "重启前: 3080 健康" ; else log "重启前: 3080 已不可达(仍继续,尝试恢复)"; fi

# 2. 备份 profile(回滚材料)
BACKUP=""
if [ -f "$PROFILE_DIR/package.json" ]; then
  BACKUP="$PROFILE_DIR/package.json.bak-restart-$(date +%s)"
  cp "$PROFILE_DIR/package.json" "$BACKUP"
  log "profile 已备份: $BACKUP"
fi

# 3. 重启
pm2 restart dsh-web >> "$LOG" 2>&1
log "已执行 pm2 restart dsh-web"

# 4. 验证(最多等 60 秒)
ok=0
for i in $(seq 1 30); do
  sleep 2
  if curl -s -o /dev/null -m 3 "$URL"; then ok=1; break; fi
done

if [ "$ok" = "1" ]; then
  log "✅ 重启成功, 3080 返回 200"
  exit 0
fi

# 5. 失败:回滚 profile + 再重启
log "❌ 3080 未就绪, 尝试回滚 profile..."
if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
  cp "$BACKUP" "$PROFILE_DIR/package.json"
  log "profile 已回滚"
fi
pm2 restart dsh-web >> "$LOG" 2>&1
for i in $(seq 1 30); do
  sleep 2
  if curl -s -o /dev/null -m 3 "$URL"; then log "✅ 回滚后重启成功"; exit 0; fi
done
log "❌ 回滚后仍不可达, 请人工检查: pm2 logs dsh-web"
exit 1
