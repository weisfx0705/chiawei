# 電影混音｜創新教學成果

義守大學電影與電視學系 114 學年度第 2 學期課程成果網站，授課教師為陳嘉暐。以 5.1 環繞錄音室為核心，呈現觀影分析、AI 聲音工具、ADR、Foley 與 Pro Tools 混音的學習過程。

[網站入口](https://weisfx0705.github.io/chiawei/114-2_sound-mix/) · [主專案說明](../README.md)

## 內容

- 五階段學習路徑、課堂照片與學生聲音重製作品。
- ElevenLabs 語音、Suno 配樂與 Krotos 音效在電影聲音流程中的應用。
- 5.1 錄音室筆記、觀影心得及工具使用分析報告。
- AI 素材片尾標注範例，可在頁面複製使用。
- 期末問卷的匿名彙整與反思。網頁呈現已整理的結果，沒有即時問卷蒐集功能。

## 本機預覽

從儲存庫根目錄執行：

```sh
cd 114-2_sound-mix
python3 -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8000/`，按 Ctrl+C 停止。網站為純靜態頁面，無須安裝套件、建置或啟動後端。YouTube 影片與 Google Fonts 需要連網。

## 檔案與維護

| 位置 | 用途 |
| --- | --- |
| `index.html` | 頁面內容、樣式、互動與統計摘要 |
| `assets/site/`、`assets/thumbs/` | 課堂照片與預覽圖片 |
| `assets/videos/` | 本地影片素材 |
| `assets/notes/` | 學生筆記、心得與 PDF |
| `assets/doc/` | AI 工具使用分析報告 |
| `assets/credits/`、`assets/logos/` | 片尾標注示例與工具標誌 |
| `build_poster.py`、`poster_design_philosophy.md` | 成果海報產生程式與設計說明 |

發布時保留 `index.html` 與 `assets/` 的相對位置，隨主專案部署即可。海報程式不是網站執行依賴；若需重製海報，須另備 Pillow、qrcode 與程式指定的本機字型，並確認輸出路徑。

學生作品、電影片段、照片與 AI 素材應保留原有來源及標注；網站公開不代表可任意再散布這些素材。
