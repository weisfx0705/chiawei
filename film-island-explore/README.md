# 影視課程島｜高中生探索版

以 `film-island` 為起點建立的獨立副本，原版未修改。

## 使用方式

雙擊 `open.command`，或在本資料夾執行 `python3 -m http.server 8779 --bind 127.0.0.1`。不需要 npm 或建置。將本資料夾完整放到靜態網站即可使用。

## 內容原則

共同必修主島＋八個專業方向是主體；短片、金種子影展、海外創作、畢業製作是實作亮點。每個方向三門代表課，以原專案 `cohorts.js` 的 115 學年度資料核對課號、課名與必選修。省略學分、年級分層與個別修課勾選；方向不是正式分組或先修關係。學習說明是白話導覽詮釋。

新版遊戲紀錄儲存在本機瀏覽器的 `film-island-playground-v1`，與原版修課紀錄、先前靜態探索收藏分開。主島任務 50 XP，每個專業方向首次完成 100 XP，探索三個方向後可以回主島完成首映體驗並獲得 150 XP；重玩不重複發放。八件裝備可分別穿脫，首映星環為第九件可見獎勵。XP 與徽章純屬遊戲體驗，不代表學分、能力認證或實際影展獲獎。

全螢幕 3D 場景包含飛行角色、展開式滑翔翼、飛行軌跡、摩天輪、熱氣球、各島系所招牌與角色工作證。三種片場光線及聲音任務直接提供感官互動；使用系統「減少動態效果」時縮短飛行並停用裝飾動畫和灑花。正式 logo 沿用原版 `logo.png`。

之前較靜態的設計保留在工作區 `output/explore-editorial-backup/` 供參考。預告片點選才載入 YouTube，切換作品及關閉視窗會移除播放器，並保留 YouTube 備援連結。WebGL 不可用時仍可用方向按鈕閱讀課程。

## 資料與圖片來源

整理日期：2026-11-01。新加坡拍攝足跡由陳嘉暐老師於需求中補充；本次官方頁面可查得的精選預告為馬來西亞、香港、日本，不虛構新加坡作品。

- [international](https://filmtv.isu.edu.tw/page/國際學生圓夢-B6Ss1rdcwF6p)
  - `assets/international0.webp`：https://filmtv.isu.edu.tw/storage/images/1EreLxEeG8AeXMwyg9bH11Hfrdm8OYl5CLviFsTa.webp
- [studio](https://filmtv.isu.edu.tw/page/劇情片創作基地-POkeemkejgw9)
  - `assets/studio0.webp`：https://filmtv.isu.edu.tw/storage/images/z3BkiUub2As5Q9HfI1HyKBabSvWV25ZGwWUskZhV.webp
  - `assets/studio1.webp`：https://filmtv.isu.edu.tw/storage/images/AOxVAIbycX43y1FIA9oZ1MVk5SfMzpPI7Aaj11FW.webp
  - `assets/studio2.webp`：https://filmtv.isu.edu.tw/storage/images/VGC09zlxtyg2hYN6Deb0AaHrk0u0Nc5msXdbZsSZ.webp
- [festival](https://filmtv.isu.edu.tw/page/金種子影展-eHuzV3b55BRq)
  - `assets/festival0.webp`：https://filmtv.isu.edu.tw/storage/images/i4HdyTsa8gRtG4rM5GXJfw93iIGcJatR7PPJFomO.webp
- [equipment](https://filmtv.isu.edu.tw/page/先進設備與專業場域-xL7rn8ycLkgT)
  - `assets/equipment0.webp`：https://filmtv.isu.edu.tw/storage/images/zpsrkWg48dWGzLCodEQaFAqMkQttCk9lw4UKuNAj.webp

官方照片保持原圖；權利歸原權利人。Three.js r128 及 OrbitControls 為 MIT 授權，vendor 檔案保留原授權聲明。


## 作品與畢業殿堂更新（2026-11-01）

- `media.js`：42 支影片索引，14 支海外創作（馬來西亞 11、香港 2、日本 1）、15 支課程與幕後、12 支其他學生作品、1 支指定畢業開幕片。相同 YouTube ID 不重複列入。
- 每個課程島都有對應的真實作品／幕後：到站的發現卡、任務內縮圖、領獎後作品卡及 3D 看板都可打開放映庫。
- 系網職涯頁的五大職能以獨立介紹呈現；遊戲八個方向是課程探索整合，不混稱官方正式分組。
- `assets/media/` 保存 YouTube oEmbed 回傳的縮圖，保留原圖；每筆影片在 `media.js` 記錄原始來源、原頻道名稱與縮圖來源。不下載或重新上傳原影片。
- 完成主島＋至少三個專業方向後可進入畢業製作殿堂。指定放映為第十屆畢業影展《第拾場：離站 Action》開幕宣傳片 `CREEG-mTJvQ`，不標作當屆活動。
- `music.js` 使用 Web Audio 即時合成原創探索旋律與首映和聲，不依賴音樂檔案或外部 API。首次互動後啟動，可獨立關閉。影片嵌入時暫停，收起播放器／離開放映時恢復；使用者已關閉音樂時不會自動重開。頁面轉到背景時暫停。
- 影片播放由 YouTube 與原上傳者控制。每支皆保留外開 YouTube 備援連結；本機 UI 測試不等同於保證所有影片在各地區皆可播放。

新增資料來源：
- 系網首頁：https://filmtv.isu.edu.tw/
- 影視風雲榜：https://filmtv.isu.edu.tw/page/亮點作品成果-JfEVPyfUbZaT
- 職涯發展：https://filmtv.isu.edu.tw/page/職涯發展-FEN6gUE0FpjS
- 特色課程成果：https://filmtv.isu.edu.tw/page/特色課程成果-SzSjDUCpTpRC
- 影視新科技：https://filmtv.isu.edu.tw/page/影視新科技-ixrKepwV1jxp
- 歷屆畢業展：https://filmtv.isu.edu.tw/page/畢業展演-T9MtIRZxbvPx
- 官方 YouTube 頻道：見 `media.js` 的 `channel`（由系網頁尾連結核對）。


## 飛行、試衣間與精神時光屋更新（2026-11-01）

- 起飛使用滑音跳躍聲，抵達有落地音；飛往課程島、時光屋與殿堂皆接入。新版音效預設開，使用者關閉後會保留設定（`sfxVersion: 2`）。配樂和音效仍可分別控制。
- 裝備圖鑑內有可拖曳及按鈕旋轉的即時角色，穿脫不重建圖鑑。沿用同一個角色預覽 renderer；開啟時將 canvas 移入試衣間，關閉／切換視窗時移回 HUD，避免新增 WebGL context。
- 「畢業製作・精神時光屋」是殿堂旁邊的獨立浮島，殿堂保留原本指定的開幕片放映。課程內及畫面入口都可以前往時光屋。
- 時光屋從官網海外創作與學生作品中隨機抽三部，依作品名稱去重、至少一部海外創作，並排除上一組；上一組保存在 sessionStorage。每張縮圖可播放，播放時保留另外兩個選項，也可「再抽三部」。不將所有觀摩作品稱為畢業製作。
- 背景摩天輪由 0.8 倍改為 1.8 倍，移到群島正後方；輪前使用放大的正式系所 logo 招牌。
- 九座課程島在上方直接顯示《代表課程名稱》，三個創作選項各有《課程名稱》連結，下方課程明細常駐展開，標明必修／選修。挑戰是課程概念體驗，不是官方指定作業或先修規定。


## 手機／平板與場景版面更新（2026-11-01）

- 手機和平板以地圖優先：介紹面板預設約螢幕三分之一，頂端常駐展開／收合與關閉按鈕；展開後可完整閱讀課程與操作任務。關閉介紹會恢復底部可橫滑的島嶼選單。
- 小尺寸 HUD 保留角色、等級與 XP；大型旋轉角色在裝備圖鑑。次要功能整理進「更多」，不刪除音樂、音效、影片、時光屋、殿堂、影展或冒險卡入口。
- 相機依可見地圖區取景；手機橫向使用較寬的雙排場景。320–1366px 的手機／平板直橫向與 1440px 桌面均已檢查。
- 群島間距略增，殿堂與時光屋仍維持同一側；螢幕標籤會在鄰近範圍避讓，必要時以細引線指回浮島。
- 摩天輪前招牌改用系網正式橫式標誌，保留原比例，置入圓角框體、金屬邊框與支架；避免被攝影島與輪輻遮住。桌面任務 HUD 移至角色下方，避開摩天輪。
- `assets/department-logo-official.png` 來源：https://filmtv.isu.edu.tw/storage/images/KV3fyzWZALDWCaz1E6qnid88WwMGFOMDZ1uALkHF.png （官方網站頁首標誌，原始 418×70 PNG，保留原圖）。
