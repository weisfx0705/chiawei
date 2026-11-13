# 正圈與反圈影片截圖

用途：`../15.html` 的收線教學與來源紀錄。

來源：QSC — How to properly roll a cable
- 原廠教學：https://training.qsc.com/mod/book/tool/print/index.php?id=1715
- 影片：https://www.youtube.com/watch?v=PJjMc-tTksU

| 檔案 | 時間 | 操作 |
| --- | --- | --- |
| `qsc-101.webp` | 1:41 | 正圈：同向取線 |
| `qsc-108.webp` | 1:48 | 正圈：帶回交圈 |
| `qsc-123.webp` | 2:03 | 反圈：反向取線 |
| `qsc-127.webp` | 2:07 | 反圈：翻腕交圈 |

保留原始影片截圖、播放器時間與字幕；僅轉換成 WebP 供網頁載入。頁面附來源與對應時間連結。
畫面左側是示範者右手（取線），畫面右側是左手（持圈）。

## 第一人稱示範（新增）

Javier Mercedes — How To Wrap a Cable the Right Way Over Under
https://www.youtube.com/watch?v=uKlaXb-fLrg&t=5s

| 檔案 | 時間 | 操作 |
| --- | --- | --- |
| `pov-65.webp` | 1:05 | Step 03：① 順勢取線 |
| `pov-74.webp` | 1:14 | Step 03：② 正圈交給左手 |
| `pov-105.webp` | 1:45 | Step 04：① 取下一段 |
| `pov-110.webp` | 1:50 | Step 04：② 轉換右手握法 |
| `pov-124.webp` | 2:04 | Step 04：③ 帶出反圈 |
| `pov-132.webp` | 2:12 | Step 04：④ 反圈交給左手 |
| `pov-175.webp` | 2:55 | Step 05：繼續取線 |
| `pov-280.webp` | 4:40 | Step 05：交替收成一束 |

由瀏覽器已解碼的原始影片畫面擷取，核對呈現影格時間後保存，再轉為 WebP；不包含播放器覆蓋介面，沒有重繪、鏡像或改變手勢。八張圖片放在正圈、反圈與交替練習區，全部直接展開。QSC 截圖保留為資料素材，現在的兩支主教學影片為 Javier Mercedes 與 Randy Coppinger。保留第一人稱影片的左右手方向，並附作者與時間連結。


## 收納照片與新版頁面

- `finished-connectors.webp`：Geistnote / Grimm Audio TPR 商品實拍，僅用於觀察兩端接頭在線束外側的位置；不把照片中的固定帶視為可退式束帶。
  - https://geistnote.com/grimm-audios-tpr-balanced-cable-builder/
  - https://cdn11.bigcommerce.com/s-iq99dfbppw/images/stencil/960w/products/314/1734/IMG_2020__35749.1678505468.JPG?c=2
- `releasable-tie.webp`：KSS HV 可退式束帶鎖頭實拍，展示可按壓的釋放卡榫。
  - https://www.kss.com.tw/index.php?action=products3-1&fid=3&sid=26&cid=31
  - https://www.kss.com.tw/upload/product/0315-1-1BK.jpg
- `hero-hands.webp`：Javier Mercedes 原影片 4:10 影格，作首屏實作畫面。
- `lesson.css`、`lesson.js`：單元樣式與影片／步驟控制；無建置需求。
- `taste/`：原樣保留 taste 技能的基礎樣式與微互動程式，教學頁調整另寫於 `lesson.css`。

頁面直接建議可退式束帶，不以學校慣例作為說明。實拍照片保留原貌；未以生成圖改造接頭、線材或束帶。


## 現行版：雙視角收線練習

- `workshop.css`、`workshop.js` 是目前載入的樣式與互動；不載入前版 `lesson.*` 或 `taste/`。
- 第一人稱與第三人稱影片使用相同影片卡、16:9 播放區及播放按鈕。桌面同列；手機依序展開，沒有折疊影片。
- 藍色只標示正圈，橘色只標示反圈；兩個視角的影片卡使用相同配色，以免誤以為每支影片只教其中一種圈。
- `third-person-poster.webp`：Randy Coppinger 原片 0:23 的真實畫面，作第三人稱影片封面；以 CSS 配合播放框比例顯示，未重繪手勢。
- 八張第一人稱截圖全部直接顯示。圖片點擊開啟原頁大圖，支援 Esc 關閉及焦點返回；停用 JavaScript 時仍可直接開啟圖片檔。
- 兩支影片均可直接啟動；切換時還原另一支影片封面，避免聲音重疊。
- 保留可退式束帶建議、兩端接頭位置照片與來源說明；不加入生成手勢圖。
