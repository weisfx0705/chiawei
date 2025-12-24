# Google Apps Script: 影視錄音實務課程 - 課後知識問卷生成器 (20題版)

請將以下程式碼複製到 [Google Apps Script](https://script.google.com/) 專案中，並執行 `createSoundCourseQuiz` 函式。

執行後，您的 Google Drive 中將會自動產生一份名為「影視錄音實務課程 - 課後知識評量 (完整版)」的 Google 表單。

```javascript
function createSoundCourseQuiz() {
  // 1. 建立表單
  var form = FormApp.create('影視錄音實務課程 - 課後知識評量 (完整版)');
  
  form.setDescription('本問卷旨在評量學生對於「影視錄音實務課程互動教學」網站內容的理解程度。\n' + 
                      '測驗範圍包含：同步錄音態度、現場成音、錄音流程、聲道設定、麥克風原理及聲音部門分工。\n' +
                      '總分：100分 (共20題，每題5分)');
  
  // 設定為測驗 (Quiz)
  form.setIsQuiz(true);
  
  // ==========================================
  // 單元 1: 電影同步錄音基本態度 (8.html)
  // ==========================================

  // Q1: SNR
  addMultipleChoiceItem(form, 
    '1. 在電影同步錄音中，我們追求的首要目標是什麼？',
    [
      '追求越高的採樣率 (Sample Rate) 越好',
      '追求最高的訊噪比 (High Signal-to-Noise Ratio)，即對白大聲、噪音小聲',
      '追求使用最昂貴的麥克風機型',
      '追求錄到最多的環境噪音以增加臨場感'
    ],
    1
  );

  // Q2: Boom Operator Standard
  addMultipleChoiceItem(form,
    '2. 關於 Boom Operator (麥克風操作員) 的操作準則，下列何者正確？',
    [
      '麥克風應該離演員越遠越好，才不會有壓迫感',
      '只要麥克風不穿幫，聲音大小不重要，後期可以調大',
      '麥克風應在「不穿幫」的前提下，離演員嘴巴越近越好 (Sweet Spot)',
      '為了收音清晰，麥克風可以直接放入畫面中穿幫沒關係'
    ],
    2
  );

  // Q3: Inverse Square Law
  addMultipleChoiceItem(form,
    '3. 根據聲音傳播的物理特性，若麥克風與音源的距離縮短一半，理論上音量會增加多少？(反平方定律)',
    [
      '增加 3dB',
      '增加 6dB',
      '增加 10dB',
      '音量不會改變，只會改變頻率'
    ],
    1
  );

  // Q4: Frame Line Check
  addMultipleChoiceItem(form,
    '4. 當 Boom Operator 想要爭取更近的收音距離時，他應該經常與哪個部門溝通「Frame 上緣在哪裡」？',
    [
      '製片組 (Production)',
      '美術組 (Art Dept)',
      '燈光組 (Gaffer)',
      '攝影組 (Camera Dept)'
    ],
    3
  );

  // ==========================================
  // 單元 2: 現場成音與轉播思維 (9.html)
  // ==========================================

  // Q5: Best Source
  addMultipleChoiceItem(form,
    '5. 在拍攝演講或活動紀錄時，為了獲得最乾淨的講者聲音，最佳的訊號來源是？',
    [
      '直接使用攝影機機頂的麥克風',
      '從現場音控台 (PA Mixer) 索取 Line Out / AUX 訊號',
      '架設一支麥克風在觀眾席收音',
      '依靠相機內建的麥克風'
    ],
    1
  );

  // Q6: Backup Plan
  addMultipleChoiceItem(form,
    '6. 如果活動現場無法取得 Mixer 的訊號，作為權宜之計，無線麥克風應該放置在哪裡效果較佳？',
    [
      '放在攝影機旁邊',
      '放在房間的正中央',
      '貼在現場廣播喇叭 (PA Speaker) 附近，越近越好',
      '放在室外以避免回音'
    ],
    2
  );

  // Q7: Multi-cam Consistency
  addMultipleChoiceItem(form,
    '7. 多機導播 (Multi-cam) 作業時，為何不建議每台攝影機只使用各自的機頂麥克風？',
    [
      '因為機頂麥克風太重，會影響運鏡',
      '因為畫面切換時，聲音的空間感與音質會跟著跳動，破壞時間連續感',
      '因為攝影機沒有耳機孔可以監聽',
      '因為電池會消耗太快'
    ],
    1
  );

  // Q8: Bad Source
  addMultipleChoiceItem(form,
    '8. 使用機頂麥克風錄製遠處講者時，最容易遇到的音質問題是什麼？',
    [
      '聲音太大導致爆音',
      '嚴重的空間殘響 (Reverb) 與周遭觀眾噪音',
      '無線電波干擾',
      '低頻過多'
    ],
    1
  );

  // ==========================================
  // 單元 3: 錄音工作流程與術語 (10.html)
  // ==========================================

  // Q9: Sequence
  addMultipleChoiceItem(form,
    '9. 劇組現場標準的開機流程順序，下列何者正確？',
    [
      'Action -> Roll Sound -> Roll Camera -> Slate',
      'Roll Camera -> Roll Sound -> Speed -> Action',
      'Roll Sound (錄音開機) -> Wait for Speed (確認走順) -> Roll Camera (攝影開機) -> Slate (打板) -> Action',
      'Slate -> Roll Camera -> Action -> Roll Sound'
    ],
    2
  );

  // Q10: Who calls Speed
  addMultipleChoiceItem(form,
    '10. 在錄音機按下 REC 後，確認機器運作正常（Pre-roll 完成），應該由誰大喊 "Speed!"？',
    [
      '導播 (Director)',
      '助導 (AD)',
      '錄音師 (Sound Mixer)',
      '場記 (Script)'
    ],
    2
  );

  // Q11: SNG Glossary
  addMultipleChoiceItem(form,
    '11. 在聲音報表中，若某個鏡頭因為飛機經過或收音穿幫導致聲音無法使用，應標註什麼術語？',
    [
      'MOS (Mit Out Sound)',
      'SNG (Sound No Good)',
      'WILD (Wild Track)',
      'SYNC (Synchronization)'
    ],
    1
  );

  // Q12: Tail Slate
  addMultipleChoiceItem(form,
    '12. 術語 "TS" (Tail Slate) 代表什麼意思？',
    [
      '完全不打板',
      '需要在鏡頭結束前補打板 (打尾板)，通常會將板子倒置示意',
      '特寫鏡頭 (Tight Shot)',
      '測試訊號 (Test Signal)'
    ],
    1
  );

  // ==========================================
  // 單元 4: 聲道設定與 PolyWAV (11.html)
  // ==========================================

  // Q13: Mono Mixing
  addMultipleChoiceItem(form,
    '13. 處理單一麥克風收錄的對白素材 (Mono Source) 時，正確的混音方式為何？',
    [
      '將其 Pan 到極左或極右',
      '將其轉換為 Stereo 檔案，左邊大聲、右邊小聲',
      '保持 Mono 特性，將其 Pan 在正中間 (Center)，確保聲音結像清晰',
      '加上大量的 Echo 讓它聽起來像立體聲'
    ],
    2
  );

  // Q14: PolyWAV Definition
  addMultipleChoiceItem(form,
    '14. 什麼是 "PolyWAV" 格式？',
    [
      '一種包含影像與聲音的壓縮格式',
      '一個單一的 WAV 檔案，但內部封裝了多個獨立的音軌 (Channels/ISO Tracks)',
      '專門用來播放環繞音效的 MP3',
      '只能錄製左右兩聲道的傳統格式'
    ],
    1
  );

  // ==========================================
  // 單元 5: 麥克風原理 (12.html)
  // ==========================================

  // Q15: Phantom Power
  addMultipleChoiceItem(form,
    '15. 使用「電容式麥克風 (Condenser Mic)」時，為什麼需要開啟 +48V 幻象電源？',
    [
      '為了讓麥克風上的 LED 燈亮起',
      '為了加熱麥克風避免結冰',
      '因為電容式麥克風內部的極板與大器電路需要電力才能運作',
      '是為了增加動圈式麥克風的音量'
    ],
    2
  );

  // Q16: Dynamic Mic Principle
  addMultipleChoiceItem(form,
    '16. 動圈式麥克風 (Dynamic Mic) 的發電原理類似於什麼？',
    [
      '小型發電機 (線圈在磁場中運動產生電流)',
      '蓄電池放電',
      '光能轉換為電能',
      '電容極板充電'
    ],
    0
  );

  // Q17: Mic Selection
  addMultipleChoiceItem(form,
    '17. 在未做隔音處理的普通房間錄製 Podcast，為了減少環境噪音與空間回音，建議優先選擇哪種麥克風？',
    [
      '高靈敏度的電容式麥克風 (Condenser)',
      '指向性較低的全向性麥克風 (Omni)',
      '靈敏度較低、收音範圍較小的動圈式麥克風 (Dynamic)',
      '相機內建麥克風'
    ],
    2
  );

  // ==========================================
  // 單元 6: 聲音部門 (13.html)
  // ==========================================

  // Q18: Foley
  addMultipleChoiceItem(form,
    '18. 原創重現角色腳步聲、布料摩擦聲與手持道具聲的工藝，稱之為？',
    [
      'ADR',
      'Foley (擬音)',
      'SNG',
      'Mastering'
    ],
    1
  );

  // Q19: ADR
  addMultipleChoiceItem(form,
    '19. 當現場收音因噪音過大無法使用，需請演員回錄音室重新配音，這個過程稱為？',
    [
      'ADR (Automated Dialogue Replacement)',
      'Foley',
      'Live Mixing',
      'Score Composing'
    ],
    0
  );

  // Q20: Re-recording Mixer
  addMultipleChoiceItem(form,
    '20. 在後期製作中，負責操作控制台，將對白、音樂、音效平衡到技術標準狀態的人員是？',
    [
      'Foley Artist (擬音師)',
      'Boom Operator (Boom Operator)',
      'Re-recording Mixer (混音師)',
      'Location Legend (場景經理)'
    ],
    2
  );

  Logger.log('表單已建立：' + form.getEditUrl());
  Logger.log('發布網址：' + form.getPublishedUrl());
}

/**
 * 輔助函式：新增選擇題 (每題5分)
 */
function addMultipleChoiceItem(form, title, choices, correctIndex) {
  var item = form.addMultipleChoiceItem();
  item.setTitle(title);
  item.setPoints(5); // 設定每一題 5 分
  
  // 建立選項並設定正確答案
  var choiceObjects = [];
  for (var i = 0; i < choices.length; i++) {
    if (i === correctIndex) {
      choiceObjects.push(item.createChoice(choices[i], true));
    } else {
      choiceObjects.push(item.createChoice(choices[i], false));
    }
  }
  
  item.setChoices(choiceObjects);
}
```
