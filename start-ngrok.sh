#!/bin/bash
# 启动 ngrok 隧道（后台运行，使用随机域名）

cd "$(dirname "$0")"

# 检查后端是否在运行
if ! curl -s http://localhost:4000/api/health > /dev/null; then
  echo "后端服务没在 4000 端口运行，先启动后端："
  echo "  cd server && npm run dev"
  exit 1
fi

# 检查 ngrok 是否已在运行
if pgrep -f "ngrok http" > /dev/null; then
  echo "ngrok 已经在运行了"
  echo "查看日志: tail -f /tmp/ngrok.log"
  exit 0
fi

# 启动 ngrok（后台，不指定域名，使用随机域名）
nohup ngrok http 4000 > /tmp/ngrok.log 2>&1 &
sleep 5

if pgrep -f "ngrok http" > /dev/null; then
  echo "ngrok 启动成功！"
  echo "查看公共 URL: ngrok http 4000 的控制台输出，或访问 http://localhost:4040"
  echo "日志: tail -f /tmp/ngrok.log"
  echo ""
  echo "获取到新的 URL 后，请更新 server/.env 中的 CORS_ORIGIN:"
  echo "  CORS_ORIGIN=https://你的新域名.ngrok-free.dev,http://localhost:8080,http://localhost:5173"
  echo "然后重启后端: cd server && npm run dev"
else
  echo "ngrok 启动失败，查看日志:"
  cat /tmp/ngrok.log
fi
