# 元宇宙 VR 影片製作 — 課程成果報告網站

義守大學 電影與電視學系 ｜ X+AI 特色課程 114 學年第 2 學期
授課教師：張國甫、陳嘉暐

**線上網址（GitHub Pages）**：https://weisfx0705.github.io/chiawei/114-2_meta-vr/

這是一個**純靜態網站**，沒有任何後端或建置流程，可直接部署。
站內全部使用相對路徑，因此可放在網域根目錄或任何子目錄（如上方的 `/chiawei/114-2_meta-vr/`）皆能正常運作。

## 目錄結構

```
114-2_meta-vr/
├── index.html              # 主頁（單頁式，含所有區段）
├── assets/
│   ├── css/style.css       # 樣式
│   ├── js/main.js          # 互動（導覽、捲動揭露、相簿燈箱、YouTube 延遲載入）
│   ├── js/photos-manifest.js # 自動產生的照片清單（依日期）
│   └── img/hero-studio.jpg # 主視覺
├── teaching/               # 兩個互動教學頁（全景原理、VR 剪輯思維）
├── docs/                   # 講義下載（Insta360 Titan、DaVinci 筆記）
├── assets/img/logos/       # 工具商標（Google、Gemini、Runway、Photoshop）
└── photos/<日期>/full|thumb/ # 課堂照片（已由 HEIC 轉為網頁 JPG，含縮圖）
```

## 本機預覽

```bash
cd 114-2_meta-vr
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

> 直接用瀏覽器開 `index.html`（file://）會因瀏覽器安全限制而無法載入照片清單，
> 請務必透過上面的本機伺服器，或部署到網站空間後再瀏覽。

## 部署（擇一）

- **GitHub Pages**：將本資料夾內容推到 repo，啟用 Pages 即可。
- **Netlify / Cloudflare Pages**：拖拉本資料夾上傳，發佈目錄設為根目錄。
- **學校網站空間**：以 FTP 上傳整個資料夾即可。

## 待補與注意事項

1. **學生問卷**：頁尾預留位置，問卷回收後可再新增一個「學習回饋」區段。
2. **YouTube 影片可見度**：七部影片目前為「不公開（Unlisted）」，縮圖與嵌入皆可正常播放。
   若有任何一部被設為「私人（Private）」，網頁將無法播放，請於 YouTube 後台改為「不公開」。
3. **大型講義**：原始的 `VR_義守114-2.pptx`（90 MB）因檔案過大未納入，
   如需提供下載，可自行放入 `docs/` 並在 `index.html` 講義區新增連結。
4. 系所官網連結已設定於頁尾：https://filmtv.isu.edu.tw/
