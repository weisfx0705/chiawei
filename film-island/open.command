#!/bin/bash
# 影視課程島：雙擊啟動本機伺服器並開啟網頁。關閉這個終端機視窗即停止伺服器。

cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "找不到 python3。請先安裝 Python 3（https://www.python.org/downloads/）後再試一次。"
  read -r -p "按 Enter 關閉…"
  exit 1
fi

# 從 8765 開始找一個沒被占用的連接埠
PORT=8765
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done
URL="http://localhost:$PORT/"

echo "🎬 影視課程島"
echo "網址：$URL"
echo "關閉這個視窗（或按 Ctrl+C）就會停止伺服器。"
echo

# 伺服器起來後再開瀏覽器
( for _ in $(seq 1 30); do
    curl -s -o /dev/null "$URL" && break
    sleep 0.2
  done
  open "$URL" ) &

exec python3 -m http.server "$PORT" --bind 127.0.0.1
