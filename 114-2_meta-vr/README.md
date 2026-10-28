# 元宇宙 VR 影片製作｜課程成果報告

義守大學電影與電視學系 114 學年度第 2 學期 X+AI 特色課程，授課教師為張國甫、陳嘉暐。以 LED 虛擬棚、生成式 AI 與 VR 360 沉浸式影像三個模組，整理課堂實作、學生作品與教學紀錄。

[網站入口](https://weisfx0705.github.io/chiawei/114-2_meta-vr/) · [主專案說明](../README.md)

## 內容與操作

- 課程簡介、LED 虛擬製作、AI 工具與四組學生作品。
- VR 360 拍攝、全景後期、VR180 剪輯與頭顯測試紀錄。
- 課堂相簿可點圖放大，使用左右方向鍵換圖、Esc 關閉。
- 教學影片、Pose Game 示範與課程成果影片；VR180 成果連到 YouTube 官方播放器觀看。
- [全景影像原理](teaching/vr-panorama.html)、[VR 剪輯與專案設定](teaching/vr-editing.html)兩個互動教學頁。
- [Insta360 Titan 講義](docs/Insta360-Titan-講義.pdf)與 [DaVinci Resolve 沉浸式後期研究筆記](docs/DaVinci_Resolve_21_Immersive_研究筆記.docx)。

## 本機預覽

從儲存庫根目錄執行：

```sh
cd 114-2_meta-vr
python3 -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8000/`，按 Ctrl+C 停止。網站為純靜態 HTML、CSS、JavaScript，不需要安裝套件或啟動後端；以 HTTP 預覽可保持與正式網站相同的載入方式。

## 檔案與維護

| 位置 | 用途 |
| --- | --- |
| `index.html` | 課程內容、作品、影片與下載連結 |
| `assets/css/style.css` | 網頁樣式與響應式版面 |
| `assets/js/main.js` | 導覽、影片延遲載入、精選相簿與燈箱 |
| `assets/js/photos-manifest.js` | 照片清單資料 |
| `assets/img/` | 主視覺與工具標誌 |
| `photos/` | 依日期保存的課堂照片與縮圖 |
| `teaching/` | 互動教學頁 |
| `docs/` | PDF 講義與 DOCX 筆記 |

新增精選照片時，需同步確認 `main.js` 的 `CURATED` 清單，以及對應日期下的 `full/`、`thumb/` 檔案。發布時保留整個資料夾的相對位置，可隨主專案部署至 GitHub Pages。

YouTube 影片、縮圖與外部字型需要連網；影片能否播放仍取決於來源的可見度與嵌入設定。課堂照片、學生作品及講義的使用權利依各自來源與授權辦理。
