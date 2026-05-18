#!/bin/bash
# 强制启动 ngrok（尝试自动关闭旧 session 后重连）

cd "$(dirname "$0")"

# 检查后端
if ! curl -s http://localhost:4000/api/health > /dev/null; then
  echo "后端服务没在 4000 端口运行，先启动后端"
  exit 1
fi

# 清理本地所有 ngrok 进程
pkill -f "ngrok http" 2>/dev/null
sleep 2

# 启动新的 ngrok
echo "启动 ngrok..."
nohup ngrok http 4000 > /tmp/ngrok.log 2>&1 &
sleep 5

# 等待并获取 URL
for i in {1..30}; do
  URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('tunnels',[]); print(t[0]['public_url'] if t else '')" 2>/dev/null)
  if [ -n "$URL" ]; then
    echo ""
    echo "ngrok 启动成功！"
    echo "访问地址: $URL"
    echo ""
    echo "请更新 server/.env 中的 CORS_ORIGIN："
    echo "  CORS_ORIGIN=$URL,http://localhost:8080,http://localhost:5173"
    echo "然后重启后端: cd server && npm run dev"
    exit 0
  fi
  sleep 2
done

echo "ngrok 启动超时，查看日志:"
cat /tmp/ngrok.log | tail -20
