# 陳嘉暐 Chia-Wei Chen｜作品集、影視教學與 AI 實踐

陳嘉暐在義守大學電影與電視學系的個人網站，整理聲音設計作品、課程教材、教學成果，以及課堂與工作現場使用的小工具。

[瀏覽網站](https://weisfx0705.github.io/chiawei/) · [中文首頁](index.html) · [English](en/index.html)

## 專案導覽

本儲存庫包含以下網站與工具。各專案的入口、操作方式與檔案說明，請見對應 README。

| 專案 | 內容 | 說明文件 |
| --- | --- | --- |
| 個人作品集 | 中英文首頁、影視聲音作品、教學與 AI 實踐連結 | 本文件 |
| [數位音效設計與影視錄音實務](sound_class/index.html) | 聲學、EQ、效果器、麥克風、響度與現場錄音互動教材 | [README](sound_class/README.md) |
| [同步錄音團隊](sound_class/sound-recording-presentation/index.html) | 團隊分工、訊噪比、器材接線與聲音報表互動簡報 | [README](sound_class/sound-recording-presentation/README.md) |
| [Zoom 錄音機自學教材](sound_class/h4n_eseential/h4n.html) | H4n 與 H4essential 的現場錄音操作 | [README](sound_class/h4n_eseential/README.md) |
| [聲音球體 Sound Spheres](sound_class/sound-spheres/index.html) | 從內在念頭到環境聲景的分層聆聽練習 | [README](sound_class/sound-spheres/README.md) |
| [電影混音課程成果](114-2_sound-mix/index.html) | 114-2 學期的 5.1 錄音室、AI 聲音實作與學生作品 | [README](114-2_sound-mix/README.md) |
| [元宇宙 VR 影片製作](114-2_meta-vr/index.html) | 114-2 課程成果、全景影片教學、講義與課堂紀錄 | [README](114-2_meta-vr/README.md) |
| [對誰好？AI 時代的思考練習](know-when-to-stop/index.html) | 五週 AI 思辨課程與個人決策憲章練習 | [README](know-when-to-stop/README.md) |
| [從科幻作品導讀未來](tech_art_walk/index.html) | 科幻影集導讀、科技議題與課堂討論 | [README](tech_art_walk/README.md) |
| [影視課程島](film-island/index.html) | 依入學年度與電影職務探索修課路徑的 3D 課程地圖 | [README](film-island/README.md) |
| [TalkTwin 即席口譯](TalkTwin_intepreter/index.html) | 多語配對、即時語音口譯與文字翻譯 | [README](TalkTwin_intepreter/README.md) |
| [Google TTS Studio](TTS/index.html) | Gemini 語音生成、雙人對話與 SRT 配音 | [README](TTS/README.md) |

首頁另有其他網站與儲存庫的連結；這些外部專案的原始碼不一定包含在此。

## 班級小工具

- [學生分組小幫手](group.html)：貼上名單或匯入 CSV，設定組數、比對各組期望名單，並匯出分組結果。
- [班級幹部提名與投票產生器](election.html)：整理學生與職稱、進行提名，以 Gemini 產生建立投票表單的 Google Apps Script，再匯入回覆 CSV 計票。產生的程式碼需另到 Google Apps Script 貼上、授權並執行。

## 本機預覽

在儲存庫根目錄開啟終端機，執行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

瀏覽器開啟 `http://127.0.0.1:8000/`，即可由首頁進入各專案；按 `Ctrl+C` 停止伺服器。需要 Python 3，沒有統一的套件安裝或建置步驟。

部分教材會載入外部字型、CDN 程式、嵌入影片或呼叫 AI 服務，因此需要連網。影視課程島與聲音球體有透過 HTTP 載入資源的流程，請使用本機伺服器預覽。

TTS、TalkTwin 與投票工具的 AI 功能需由使用者提供對應服務的 API 金鑰，相關用量依服務帳號計算；麥克風功能另需瀏覽器權限。工具的設定與資料儲存方式請見各專案說明。

## 檔案與維護

- `index.html`、`en/index.html`：中英文首頁。新增或調整首頁專案資訊時，請同步核對兩個語言版本。
- `styles.css`、`image/`：首頁樣式與圖片。
- 各專案資料夾：保留 HTML、腳本及素材的相對位置，可隨主網站放在 GitHub Pages 的子路徑。

更新入口、操作方式或檔案結構時，請同步更新對應 README。素材來源與使用條件依各專案的署名及原始來源說明為準。
