# TalkTwin 即席口譯（靜態版）

瀏覽器上的**即席雙向口譯機**。講者說 A 語言就翻成 B 語言，切換到 B 就翻回 A，逐句進行，適合演講、迎新、參訪與課堂現場。

純靜態網頁，可直接放上 GitHub Pages。**沒有後端**：使用者填入自己的 OpenAI API Key，頁面直接呼叫 OpenAI，資料不會經過任何中間伺服器。

## 功能

- 18 種語言任選兩種組成配對（中文繁／簡、英、日、韓、越、印尼、泰、馬來、菲、印地、法、德、西、葡、義、俄、阿拉伯）
- 提示詞由語言配對**自動產生**：翻譯方向、口音規則、場域稱謂一次到位
- OpenAI Realtime API WebRTC 低延遲語音，逐句雙向
- 詞彙表／專有名詞對照，確保校名、單位、職稱譯法一致
- 原文字幕與譯文同時顯示
- 打字也能翻譯（Responses API + OpenAI Speech 朗讀）
- 可調語氣、斷句節奏與譯文風格
- 上傳任意圖片生成專屬配色的 WebGL 能量體；角色庫存在瀏覽器內

## 部署到 GitHub Pages

1. 把這個資料夾的內容推到 GitHub repo。
2. repo 的 **Settings → Pages → Build and deployment**，Source 選 **Deploy from a branch**，分支選 `main`、資料夾選 `/ (root)`。
3. 等一兩分鐘，網址會是 `https://<帳號>.github.io/<repo>/`。

`.nojekyll` 已經放好，Jekyll 不會處理這些檔案。整包只有約 400 KB。

> Realtime 需要麥克風權限，瀏覽器只在 **HTTPS** 或 `localhost` 才會給。GitHub Pages 是 HTTPS，沒有問題。

### 本機預覽

```bash
python3 -m http.server 8000
```

## 使用者怎麼開始

1. 開啟網址，按右上角「設定」。
2. 讀一下「使用前請先了解風險」，照著「還沒有 API Key？三分鐘申請教學」拿一把 Key。
3. 貼上 Key，按「儲存並連接」。
4. 切到「翻譯設定」，選好語言 A 與語言 B，按「儲存翻譯設定」。
5. 按「開始即席口譯」，允許麥克風。講者說一句，等翻完再說下一句。

## API Key 安全

這是**自帶金鑰（BYOK）**的靜態網頁，請如實告知使用者：

- Key 存在**使用者自己瀏覽器**的 `localStorage`，不會上傳到 repo、也不會傳給站方。
- 靜態網頁沒有後端可以代為保管，Key 會出現在瀏覽器開發者工具中，也可能被有權限的擴充功能讀取。**不要在公用電腦輸入。**
- 請使用可獨立設限的 **Project API Key**，並在 OpenAI 後台設定每月用量上限。
- 所有用量計入使用者自己的 OpenAI 帳單。Realtime 費率高於一般文字。
- 設定視窗的「移除 OpenAI Key」可隨時清掉。

頁面已用 `<meta http-equiv="Content-Security-Policy">` 限制 `connect-src` 只能連 `api.openai.com`，`script-src` 只允許同源，降低注入風險。靜態主機無法送 HTTP header 版本的 CSP，防護強度不如本機伺服器版。

## 資料存在哪裡

| 內容 | 位置 |
| --- | --- |
| API Key、模型、聲音、語言配對 | `localStorage` |
| 口譯提示詞、詞彙表 | `localStorage` |
| 角色庫中繼資料 | `localStorage` |
| 角色圖片 | `IndexedDB`（`talktwin-static`） |

全部留在使用者的瀏覽器。清除瀏覽資料就會全部消失。

## 檔案結構

```text
├── index.html        # UI、設定視窗與能量體畫布
├── styles.css        # 視覺、狀態與版面
├── orb.js            # WebGL 能量體：呼吸、說話、色盤萃取
├── app.js            # 對話、WebRTC、字幕、音訊分析與互動
├── static-api.js     # 瀏覽器內的 /api/* 實作，取代原本的 Python 伺服器
├── assets/avatar.jpeg
└── .nojekyll
```

`static-api.js` 是靜態化的關鍵：它在瀏覽器內重現本機版的每一條 `/api/*` 路由，
`app.js` 的 `fetchWithTimeout` 會把這些請求轉進去並拿到真正的 `Response`，
因此上層邏輯完全沒有改動。

## 與本機版的差異

| | 本機版（Python） | 靜態版 |
| --- | --- | --- |
| API Key | 存在 `config.local.json`，前端只看得到末四碼 | 存在瀏覽器 `localStorage` |
| 提示詞組裝 | `server.py` | `static-api.js` |
| 角色圖片 | 存到硬碟 `assets/library/` | 存到 IndexedDB |
| 五官切圖生成 | 有（需要 Pillow） | 無 —— 目前三種能量體風格都不使用 |
| 麥克風、WebRTC、能量體渲染 | 相同 | 相同 |
