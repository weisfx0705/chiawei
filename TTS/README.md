# Google TTS Studio · Gemini 3.8

純 HTML／CSS／JavaScript 的語音工作台。使用者自行輸入 Google API key，瀏覽器直接呼叫 Google，適合 GitHub Pages。支援單人朗讀、雙人對話、SRT 配音及對話稿助手。

## 使用

開啟 [TTS Studio](https://weisfx0705.github.io/chiawei/TTS/index.html)，填入自己的 [Google API key](https://aistudio.google.com/apikey)，選擇模型與語音，再生成、播放或下載 WAV。

API key 只保留在目前頁面的輸入欄位，使用 `x-goog-api-key` 請求標頭送至 Google；不寫入 URL、localStorage、檔案或日誌。重新整理頁面後需重新輸入。舊版儲存的金鑰會直接刪除，不讀取內容。Google 專案的模型權限與配額仍依各使用者的設定。

## 模型

| 模型 | 用途 |
| --- | --- |
| `gemini-3.8-flash-tts`（預設） | 高品質旁白、細膩表演、複雜雙人對話 |
| `gemini-3.8-flash-lite-tts` | 一般朗讀、大量 SRT、優先考慮速度與成本 |
| `gemini-3.1-flash-tts-preview` | 原有預覽模型相容；使用原有 30 種預設語音 |

對話稿助手使用文字模型 `gemini-3.8-flash`。

## 3.8 調整

- 台詞逐字傳送，講者與語氣放在 `speech_metadata`。
- 預設語氣留空。需要表演調整時，使用 `warm and friendly` 等短指令。
- 瞬間人聲事件使用 `<laugh>`、`<sigh>`、`<short pause>`，保留在台詞中。
- 編輯器的 `Speaker 1: [excited] 台詞` 會拆成講者、情緒、台詞欄位；3.8 不會讀出講者名稱或方括號情緒。
- 一般 3.8 回應是 WAV，直接使用；需要合併的長文及 SRT 明確要求原始 PCM，再統一輸出為 WAV（24 kHz、單聲道、16-bit）。
- 擴充語音庫可依語言載入。已儲存的 `voice_` ID 可供單人使用；雙人模式保留預設聲音。

## SRT 與長文

單人長文自動按句子／段落分段，保留原文及標籤。SRT 支援毫秒時間碼，以及 24／25／30 FPS 的非 drop-frame 影格時間碼。可選擇保留起點，或讓超時語句順延以避免重疊。

SRT 音訊依字幕物件保存，刪除或合併不會錯配。再次生成會略過相同模型、語音、風格與台詞的成功項目。取消會停止後續請求，已送出的請求仍可能完成；已完成部分可下載。

## 檔案結構

- `index.html`：介面與樣式。
- `studio.js`：編輯、生成、播放、字幕與對話稿助手。
- `gemini-client.js`：Google 3.8／3.1 請求格式、API URL、回應解析與固定錯誤訊息。
- `tts-core.js`：WAV／PCM、長文分段、時間碼與字幕音訊合併。
- `tests/`：協定、音訊及純靜態瀏覽器測試。

## 部署

正式位置為 `weisfx0705/chiawei` 儲存庫的 `TTS/` 資料夾，使用該儲存庫既有的 `main` 根目錄 GitHub Pages 設定。

部署需要的檔案為 `index.html`、`studio.js`、`gemini-client.js`、`tts-core.js`。所有腳本使用相對路徑，可部署在 `/chiawei/TTS/` 等子目錄。直接開啟頁面即可使用，不需要安裝套件或啟動應用程式伺服器。

## 測試

```sh
node --test tests/core.test.js tests/client.test.js
python3 tests/test_ui.py
```

瀏覽器測試需要 Playwright；使用隔離瀏覽器、虛構金鑰及模擬 Google API，不呼叫 Google、不產生費用，也不需要任何應用程式後端。

## 官方依據

- [Google TTS 與 3.8 遷移指南](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini 3.8 Flash TTS](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts)
- [Google API key](https://ai.google.dev/gemini-api/docs/api-key)

音訊為 AI 生成。
