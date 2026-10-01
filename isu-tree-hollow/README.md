# A Little Closer · 義守樹洞

本機製作的三語靜態網頁，可部署至既有 GitHub Pages 專案的子資料夾。學生使用自己的手機，直接在樹洞寫字、錄音或選取音檔，再送出具名分享。

姓名、Email、國籍必填，學號選填。介面並列英文、中文、越南語；內容可使用任何語言，回覆語言也包含印尼語。

## 使用方式

```sh
cd /Users/weisfx/Desktop/Cursor/chiawei/chiawei/isu-tree-hollow
python3 -m http.server 4173 --bind 127.0.0.1
```

- 學生頁面：<http://127.0.0.1:4173/>
- 一次性 Google 收件設定：<http://127.0.0.1:4173/setup.html>

本機網址僅供這台電腦預覽。學生的正式入口是你部署完成的 GitHub Pages HTTPS 網址。

## 收件如何運作

```text
學生自己的手機／電腦
  → GitHub Pages：文字、錄音與具名資料
  → Google Apps Script：驗證與儲存
  → Google Forms：表單回覆
  → Google Sheets：輔導紀錄與處理欄位
  → Google Drive：私人原始音檔
  → 你週末閱讀、轉寫、確認需求，再用 Email 回覆
```

GitHub Pages 不負責存資料。錄音使用學生裝置的麥克風；按「送出」時，網頁透過隱藏的表單框架，把文字與音檔送到 Google 收件程式。這避免跨網域 JSON 請求的預檢限制，並以 Google 回傳的收件確認顯示成功。

Google 表單的原生檔案上傳需要登入 Google。這版採 Apps Script 保存錄音，再將私人音檔連結寫入表單，因此學生不必登入 Google。只需要你事先設定並授權收件程式。

## 先完成 Google 設定

1. 到 <https://script.google.com/home> 建立 Apps Script 專案，貼上 [google/Code.gs](google/Code.gs)。本次已準備 [ISU Tree Hollow — 私人輔導收件](https://script.google.com/home/projects/1VmvKx4kgV0W_PFGP8cdroaiKq51ob3EoMRnmDggDAvhWsJW4Ifk9uJK9/edit)，授權與初始化已完成。請沿用，避免重複建立；收件端仍需建立網頁應用程式部署。
2. 執行 `setupTreeHollow`。第一次需由你審查 Google 授權。它只建立此工作的資料夾、表單與試算表，不寄信。
3. 執行記錄只列出新建立的文件網址；打開 `records` 連結並收藏。請保持表單回覆、試算表和音檔資料夾的分享權限受限。
4. 選「部署 → 新增部署 → 網頁應用程式」，執行身分為你自己，存取者選「所有人」。公開的是只供提交的程式入口，沒有查詢學生資料的功能。
5. 將部署結果的 `/exec` 網址填入 `config.js` 的 `appsScriptUrl`。也可用 `setup.html` 下載更新後的設定檔。
6. 以本機入口送出一筆文字和一段測試錄音。必須確認「已收到」、`Support records` 出現完整資料、Google Forms 回覆增加，且音檔可以播放。

Google 授權可能列出完整 Drive、表單與試算表存取權限，這是 `DriveApp`、`FormApp`、`SpreadsheetApp` 的服務範圍。程式只操作本工作建立並保存在 Script Properties 的資源 ID。請先檢視程式碼，再自行授權。

## 部署到 GitHub Pages

上傳以下檔案即可，不需要 Node、npm 或伺服器：

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `assets/`
- `.nojekyll`

例如置於既有 repository 的 `tree-hollow/` 目錄。所有網站資源使用相對路徑，支援 GitHub Pages 的 repository 子路徑。也可直接放在 Pages 的根目錄。

Google 收件程式預設允許 `https://weisfx0705.github.io`、`http://127.0.0.1:4173` 和 `http://localhost:4173`。若使用其他 GitHub 帳號或自訂網域，修改 `Code.gs` 的 `allowedOrigins`，再建立新版 Apps Script 部署。來源只填 origin，不加 repository 路徑。

設定檔只放公開網址，不能放 API key、密碼或 OAuth token。學生留言、姓名、Email、音檔和輔導紀錄均不可放進 GitHub repository。

## 週末輔導流程

`Support records` 保留原文、收件時間與私人錄音連結，另提供：

- `Transcript 逐字稿`：保存原語言轉寫。
- `Translation 中文摘要`：標示不確定的詞句，保留原文對照。
- `Need / referral 需求與轉介`：記錄具體需求與需要協助的單位。
- `Status 處理狀態`：New、Reviewing、Replied、Referred。
- `Reply draft 回覆草稿`、`Replied at 回覆時間`：週末回覆後填寫。

回覆可依「先接住心情 → 提供一個明確的下一步 → 確認是否仍需要協助」的順序。這版沒有自動回信或自動呼叫 AI；錄音由你檢視後處理。必要時轉介學校單位前，與學生確認需要分享的內容。

具名欄位用於輔導紀錄，目前是學生自行填寫，並非校務身分驗證。留空學號不影響收件，日後可補。

## 已完成與仍需驗證

- 三語、手機排版、文字輸入、錄音操作、音檔選取與試聽。
- 姓名、Email、國籍必填，學號選填；選其他國籍時需填寫國籍。
- 麥克風拒絕／不支援的提示、3 分鐘錄音上限、10 MB 檔案上限。
- 未接收件端不傳資料，也不顯示成功；失敗保留當頁內容。
- 同一收件識別碼重送可沿用紀錄、音檔與表單回覆，降低重複收件。
- 服務錯誤不回傳個人資料；試算表文字避免被當作公式執行。
- `node tests/receiver.test.mjs`：模擬 Google 服務，涵蓋身份／同意／來源驗證、音檔、重送與部分失敗後恢復。

Google 帳號授權與正式 `/exec` 部署完成前，仍不能認定雲端收件已通過。正式網站上線後，另用 iPhone Safari 與 Android Chrome 各試一筆錄音。LINE 內建瀏覽器若無法取得麥克風，改以外部瀏覽器開啟或上傳音檔。

錄音和文字目前只在當頁記憶體，重新整理或關閉頁面可能遺失未送出的內容。Google Apps Script 服務配額或尖峰排隊會造成暫時失敗；頁面會提示重試，不假裝收件成功。

## 來源

- 原 FAQ：<https://weisfx0705.github.io/OICA/isu_qa/index.html>
- LINE 社群：由提供的 QR Code 解碼，原圖保存在 `assets/line-community.png`。
- 麥克風 HTTPS 要求：<https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>
- Google Forms 原生檔案上傳登入要求：<https://support.google.com/docs/answer/15473134?hl=en>
- Google HTML 回覆框架：<https://developers.google.com/apps-script/reference/html/html-output>

## 目前 repository 位置（2026-10-01）

- 實際網站 checkout：`/Users/weisfx/Desktop/Cursor/chiawei/chiawei`
- 樹洞專案：`/Users/weisfx/Desktop/Cursor/chiawei/chiawei/isu-tree-hollow`
- GitHub：<https://github.com/weisfx0705/chiawei>，分支 `main`。
- 既有 Pages 網站：<https://weisfx0705.github.io/chiawei/>，已確認可正常開啟。
- 發布後的樹洞子路徑預計為 `/chiawei/isu-tree-hollow/`；目前尚未發布。
- 外層 `/Users/weisfx/Desktop/Cursor/chiawei` 另有僅追蹤 `.DS_Store` 的 Git repository。請從上述實際網站 checkout 操作此網站。
- `verification/` 已排除 Git 追蹤，避免將本機檢查畫面上傳。

這次搬移尚未 commit 或 push。Google 收件設定完成後，請先以測試資料確認文字與音檔都實際保存，再公開學生連結。
