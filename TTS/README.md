# Google TTS Studio · Gemini 3.8

繁體中文本機語音工作台，支援單人朗讀、雙人對話、SRT 配音與對話稿助手。

## GitHub Pages

線上介面：[https://weisfx0705.github.io/chiawei/TTS/index.html](https://weisfx0705.github.io/chiawei/TTS/index.html)

GitHub Pages 提供稿件編輯介面；語音生成仍由使用者電腦上的 Keychain 服務執行，不在公開網站存放或索取 API key。請下載本專案，啟動本機服務後，在線上介面填入終端機網址的連接埠，按右上角重新連線。Chrome 詢問本機網路權限時請允許。若瀏覽器無法連接本機，直接使用終端機顯示的本機網址即可。

也可以直接開啟已配對連接埠的線上介面：

```sh
python3 server.py --pages
```

正式發佈位置是 `weisfx0705/chiawei` 儲存庫的 `TTS/` 資料夾。由該儲存庫既有的 GitHub Pages 設定（`main` 分支、根目錄）部署；請不要把獨立 TTS 專案的根目錄工作流程複製到 `chiawei/.github/`。

## 啟動

需要 Python 3.10 以上，以及已設定好的 `~/.local/bin/with-gemini-key` Keychain wrapper。程式使用 Python 標準函式庫直接呼叫官方 REST API，不需安裝 SDK 或 npm 套件。

雙擊 **啟動 TTS.command**，或在專案目錄執行：

```sh
python3 server.py --open
```

開啟 [本機工作台](http://127.0.0.1:8765)。預設連接埠已使用時會自動選擇其他可用埠，請依終端機顯示的網址開啟；也可用 `python3 server.py --port 8766 --open`。關閉終端機或按 Ctrl+C 停止服務。

請透過本機服務開啟，直接開啟 `index.html` 只會顯示介面。本機服務只監聽 `127.0.0.1`，不作為公開網站使用。

## 模型選擇

| 模型 | 適合用途 |
| --- | --- |
| `gemini-3.8-flash-tts`（預設） | 細膩表演、複雜雙人對話、高品質旁白 |
| `gemini-3.8-flash-lite-tts` | 一般朗讀、大量 SRT、優先考慮速度與成本 |
| `gemini-3.1-flash-tts-preview` | 既有預覽模型相容；只支援原有 30 種語音 |

對話稿助手使用文字模型 `gemini-3.8-flash`。模型存取權限及配額取決於你的 Google 專案，工具不會自動切換模型。

## 3.8 使用方式

- 台詞會逐字送出，語氣及講者透過 `speech_metadata` 分開傳送。
- 先用空白語氣欄位試聽，再視需要加入 `warm and friendly` 等短指令。語氣快捷鈕僅方便選用。
- 台詞內的笑聲／停頓使用 `<laugh>`、`<sigh>`、`<short pause>`；這些是人聲事件，不是背景音效。
- 固定口音、性別、年齡與角色特徵請使用適合的語音庫聲音，或先在 [Google AI Studio](https://aistudio.google.com/generate-speech) 建立 Voice Design，再貼上已儲存的 `voice_` ID。
- 擴充語音庫可按語言載入並分頁，提供給單人及 SRT 使用。雙人模式保留 30 種預設聲音；自訂角色請逐句以單人模式生成。
- 簡易腳本仍可寫 `Speaker 1: [excited] 台詞`。編輯器會將方括號情緒轉成 metadata，不會把它送入 3.8 台詞。
- 匯入舊腳本時會移除工具原先強制加入的 `Normal Pitched and Natural` 預設指令。
- 單人長文按句子／段落自動分段，保留原文及標籤。工具上限 60,000 字，每段約 1,800 字。雙人單次請求的工具上限為 12,000 字（含語氣）；這些是工具的保守限制，不是 Google token 限制。
- 下載統一為 WAV、24 kHz、單聲道、16-bit PCM。3.8 WAV 回應直接使用，原始 PCM 才加上 WAV 標頭。

## SRT

- 標準 `HH:MM:SS,mmm`／`HH:MM:SS.mmm` 毫秒時間碼，或選擇 24／25／30 FPS 的 `HH:MM:SS:FF` 非 drop-frame 影格時間碼。
- **保留時間碼**：每句保留原始起點，超出字幕時長的語句可能重疊；混音必要時整體降低音量以避免溢位。
- **避免重疊**：後句會順延，可能失去與原畫面的同步。工具會報告超時與順延句數，不會自動裁切或加速台詞。
- 一小時起點稿件可在匯入前勾選「扣除整小時起點」。時間軸上限 30 分鐘，較長檔案請拆分。
- 同一份稿件再次按「生成語音」會略過相同模型、語音、風格及台詞的成功項目；失敗、待生成及已修改項目才會生成。
- 音訊保存在記憶體內，刪除或合併字幕不會讓其他音訊錯配。重新整理頁面會清除稿件和音訊，請先下載。
- 取消會停止等待及後續請求；已送出的 Google 請求仍可能完成並計費。部分結果可下載，缺少的字幕位置保留靜音。

## 憑證

瀏覽器不接收 API key，也不儲存憑證。每次 API 呼叫由本機服務透過 `with-gemini-key` 啟動獨立 worker，wrapper 僅在該子程序注入憑證。服務不讀取 `.env`、shell 設定、OAuth 檔案或 Keychain 原始值。舊版同來源的 `gemini_api_key` localStorage 項目會直接刪除，不讀取內容。

Google 錯誤原文及 wrapper 輸出不會回傳介面或寫入日誌，使用固定、可操作的錯誤說明。本機服務只接受同來源請求或 `https://weisfx0705.github.io` 的線上介面，限制固定靜態檔案與操作路徑，未開放其他網站或萬用 CORS。

## 檢查

```sh
node --test tests/core.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

測試檢查 3.8 協定、逐字台詞、雙人 metadata、WAV／PCM、字幕定位與混音，以及本機請求和錯誤處理。上述命令不呼叫 Google、不需要憑證。瀏覽器整合測試 `tests/test_ui.py` 另需 Playwright，使用模擬 API，不產生費用。

## 官方依據

2026-09-28 查證：

- [Google TTS／3.8 遷移與 prompting 指南](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini 3.8 Flash TTS 模型](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts)
- [Gemini 3.8 Flash-Lite TTS 模型](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-lite-tts)
- [Voices API](https://ai.google.dev/api/voices)

音訊為 AI 生成。
