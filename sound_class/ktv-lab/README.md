# 我的迷你演唱會・KTV 接線實驗室

入口：[14.html](../14.html)；已加入[影視錄音實務](../index2.html)課程卡片。

本教材以準備個人小型演唱會為場景，讓學生選器材、接 OUT → IN、操作 routing，再比較「現場聽到什麼」與「檔案留下什麼」。奶油色、珊瑚橘、薄荷綠的小舞台與器材角色，搭配即時訊號計算。無框架、無建置步驟；只有字型使用 Google Fonts，外部字型不可用時仍可操作。

## 課堂操作

1. 選麥克風數量／有線或無線、PA 能力與 MIC 輸入數、錄音機輸入數、主動或被動喇叭、Stereo 或 Mono 伴奏。
2. 選 A、B 或 C 路線。切換路線會給適合的起始器材；更換器材會清空接線與重設控制。
3. 自己依序點 OUT、IN；或先「載入示範接線」，再拔線、改控制來研究。珊瑚紅 V 代表人聲、湖水藍 B 代表伴奏、紫色 AV 代表視訊；同一條輸出混有人聲與伴奏時顯示雙色。Tab + Enter 也可接線，Escape 取消選取。窄螢幕的工作台可水平捲動，也可用設備快跳列切換聲源、PA、錄音機與舞台；切換路線時快跳順序同步更新，跳轉會保留已選的 OUT。
4. PA 控制室與現場喇叭訊號表放在同一組；錄音機控制室與錄音軌訊號表放在另一組。訊號表在捲動控制時保持可見，可直接比較音量變化；過矮的橫向螢幕改用一般排列，確保控制能操作。按 Soundcheck 看準備單與診斷。切到「影視拍攝」任務，會要求每支麥克風都有獨立乾聲軌。
5. 用「單獨聽 Vocal」「單獨聽伴奏」先認識合成小樂團，再將監聽切到現場 L/R 或任一錄音軌。約 9 秒的原創曲子循環播放，可邊接線、邊改推桿、Pan、bus；音訊立即跟隨路由變化。沒有真人錄音或麥克風權限。原始聲源試聽明確標為「不經接線」，不可把它當成 PA 已接通。
6. 各聲源卡片可單獨關人聲、伴奏或視訊。彩色線依剩餘的實際內容更新，沒有訊號時變灰虛線。視訊沒有聲音。上方監聽波形來自瀏覽器實際輸出；耳機音量只控制預覽，不回寫到錄音路由。
7. 主播放鈕離開畫面時，會出現浮動暫停控制；手機使用底部控制列，主播放鈕可見時會收起，減少遮擋。切離頁面時也會暫停。音軌監聽切換會保留曲子當前位置，方便 A/B 比較；ARM 取消的軌道會從監聽選單移除。
8. 用「測試快照」比較修改前後。只保留本頁記憶體中最近三次配置，不輸出 WAV、不上傳資料。

## 三條路線

| 路線 | 接法與學習目標 |
| --- | --- |
| A・先進 PA | 麥克風與電腦進混音台，MAIN 給喇叭，REC／AUX／Direct Out 給錄音機。REC LR 複製已混合，不能事後拆回乾淨分軌。獨立 AUX 或直出可有不同結果。 |
| B・先進錄音機 | 人聲與預先加總的 Mono 伴奏分別進錄音機，留 ISO。錄音機 Pan L／R 當兩條傳送線；PA 兩路置中，兩邊播出相同 Mono mix。 |
| C・F4 雙組輸出 | 人聲進 MAIN 1；伴奏 L/R 經 SUB 1/2；PA 人聲置中、伴奏左右分配。1 支麥克風＋Stereo 用 3 個錄音輸入；2 支麥克風用 4 個。 |

## 訊號模型

- `14.html`：語意化頁面與控制入口。
- `style.css`：可愛小舞台、器材、接線工作台、響應式與 reduced-motion。
- `audio-engine.js`：以固定種子的 PCM 合成母音主唱、另一位和聲，以及鼓、貝斯、電鋼琴左右聲部。四個音源共享 transport，經即時 GainNode、獨立乾／濕送出、合成殘響與耳機輸出保護，再進入真正的輸出 analyser。只有曲子製作時固定音源峰值；切換路由不做自動音量正規化，以保留推桿、Pan 與輸入增益的差異。
- `app.js`：純瀏覽器程式。用人聲 1、人聲 2、伴奏 L、伴奏 R 的乾聲／FX 振幅係數及視訊標記追蹤訊號。每條接線與 bus 的結果共用同一套計算，再用來顯示線色、電平、試聽與測試快照。
- OUT → IN 檢查方向與訊號類型；每插孔限一條線；同一輸入不可硬併來源。禁止功率輸出接錄音機／LINE，並檢查電氣回送循環。
- 錄音機 TRIM 影響 ISO；FADER / PAN 影響混音輸出，ARM 影響分軌是否保留。MAIN / SUB 矩陣支援輸入 OFF / PRE / POST；MAIN 選 LR 時跟隨混音 Pan。
- PA 的 REC LR 複製跟隨 MAIN 混音及總量，另有錄音輸出總量；AUX 可 pre/post；數位模型提供兩條獨立 mono bus 和 MIC Direct Out。
- 未模擬實機聲學回授、阻抗、噪音、延遲、相位與動態處理。示意 dBFS 不是實機量測。Dry 表示未與伴奏電氣混合／未加 PA FX；不保證沒有喇叭漏音、空間殘響或其他噪音。
- 本課的 1／2／3／4 軌錄音機、三種 PA 都是抽象能力模型。Zoom F4 使用四路主輸入，未建模 INPUT 5/6、膠囊、USB 或格式／取樣率限制。矩陣只建模原理，不複製機身 UI。

## 來源

- [ZOOM F4 原廠手冊](https://zoomcorp.com/media/documents/F4_OperationManual_English.pdf)：p.25–28、70–71、90–96。
- [ZOOM F4 原廠產品資料](https://zoomcorp.com/en/us/field-recorders/field-recorders/f4-field-recorder/)：MAIN / SUB、主輸入、獨立軌與混音。
- [Yamaha MG10XU / MG10 原廠手冊](https://data.yamaha.com/files/download/other_assets/1/331001/mg10xu_en_om_c0.pdf)：對照 MAIN / MONITOR / AUX / FX SEND；本課 PA 模型不等同 MG10XU 規格。

## 驗證

需要 Python 與 Playwright Chromium。在儲存庫根目錄：

```sh
python3 /Users/weisfx/.codex/skills/webapp-testing/scripts/with_server.py \
  --server "python3 -m http.server 8765 --bind 127.0.0.1" --port 8765 \
  -- python3 sound_class/ktv-lab/tests/test_lab.py
```

已有 8765 預覽伺服器時，可直接執行：

```sh
python3 sound_class/ktv-lab/tests/test_lab.py
python3 sound_class/ktv-lab/tests/test_audio.py
python3 sound_class/ktv-lab/tests/test_responsive.py
python3 sound_class/ktv-lab/tests/test_paired_panels.py
node sound_class/ktv-lab/tests/test_synth.cjs
node --check sound_class/ktv-lab/app.js
node --check sound_class/ktv-lab/audio-engine.js
```

測試透過頁面操作驗證接線、錯誤訊號、PA 混合不可逆、音量相依、乾聲、TRIM / FADER / ARM、AUX pre/post、數位 BUS、F4 矩陣、雙人立體伴奏、被動喇叭、輸入容量、ISO / LR、快照、合成試聽、回送、鍵盤、390／768／1440 px、減少動態效果，以及封鎖外部請求後的基本操作與課程卡片。

新增音訊測試直接從瀏覽器輸出 analyser 讀取 PCM，驗證實際可聽輸出／靜音、立體伴奏差異、PAN 振幅比例、MAIN / FADER 與 ISO 的獨立性、ARM 監聽目標、視訊獨立性、暫停、耳機音量、來源分色與沒有麥克風權限請求。`test_synth.cjs` 驗證合成結果可重現、樣本有限、音源有聲音且保留餘裕、雙人與左右伴奏確實不同。

手機採全寬器材選單與通道卡片；平板直向將兩個控制室依序排列，室內通道維持雙欄。觸控版選單使用至少 16px 字體，主要按鈕與接孔保留 44px 操作高度。`test_responsive.py` 以 320／390／600／820／1024／1180／1440px 驗證內容範圍、觸控大小、設備快跳、跨設備接線、旋轉後保留接線，以及播放器顯示／收起規則。

`test_paired_panels.py` 以手機、平板與桌機驗證：調整 PA 與錄音機控制時，對應的訊號表和使用中的控制同時可見；PA 音量、錄音 TRIM、FADER、下方 F4 通道的訊號數值也會依原本的路由正確更新。
