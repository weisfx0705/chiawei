/* 電影與電視學系 課程島：手寫的設計層資料
 * 課程本身（課號、課名、學分、年級學期、職務路線）在 cohorts.js，由 tools/build_film.py 從整理檔產生。
 * 這裡放的是設計詮釋：七大職務、四個年級的顏色、每門課對應的裝備與所屬小島。
 */
(function () {
  // 八個電影職務：前七個依《電影職務四年課程養成研究》，美術組由本地圖依課程計畫補充
  const ROLES = [
    { id: 'dir', name: '導演組', island: '導演編劇島', sub: '導演・副導演・編劇・場記・選角', color: '#E4572E', icon: '🎬', titles: ['場記見習生', '副導演', '導演'] },
    { id: 'pro', name: '製片組', island: '製片片廠島', sub: '總製片・生活製片・場景製片', color: '#3E9B57', icon: '📋', titles: ['製片助理', '製片', '總製片'] },
    { id: 'cam', name: '攝影燈光組', island: '攝影燈光島', sub: '攝影・攝影助理・燈光師', color: '#2E86AB', icon: '🎥', titles: ['攝影助理', '攝影師', '攝影指導'] },
    { id: 'art', name: '美術組', island: '美術造型島', sub: '美術指導・場景陳設・服裝造型・化妝', color: '#C9A227', icon: '🎨', titles: ['美術助理', '美術設計', '美術指導'], supplement: true },
    { id: 'snd', name: '聲音組', island: '聲音錄音島', sub: '錄音・擬音・混音・聲音設計', color: '#7B61C9', icon: '🎧', titles: ['收音助理', '錄音師', '聲音設計'] },
    { id: 'edt', name: '剪輯組', island: '剪輯特效島', sub: '剪輯・特效・調光', color: '#16A3A0', icon: '💻', titles: ['剪輯助理', '剪接師', '後期總監'] },
    { id: 'mkt', name: '影視行銷', island: '行銷發行島', sub: '分析・發行・活動・編輯・宣傳', color: '#D6457F', icon: '📣', titles: ['宣傳小編', '行銷企劃', '發行總監'] },
    { id: 'res', name: '影視研究', island: '影評研究島', sub: '美學・評論・歷史', color: '#8A6248', icon: '📚', titles: ['影迷', '影評人', '電影學者'] },
  ];

  // 四個年級＝四個季節：一眼分出大一到大四
  const YEARS = [null,
    { name: '大一', em: '🌸', season: '春', color: '#EE8FAE', tile: '#F6B3C8', label: '影視基礎' },
    { name: '大二', em: '🌿', season: '夏', color: '#5DB55A', tile: '#A9DB8C', label: '製作實務' },
    { name: '大三', em: '🍁', season: '秋', color: '#E58A2E', tile: '#F6BF73', label: '專業深化' },
    { name: '大四', em: '❄️', season: '冬', color: '#5E9CD8', tile: '#AFCFF0', label: '畢業整合' },
  ];

  // 島嶼：main 在中央，其餘依 ring 繞一圈（0 = 正前方）
  const ISLANDS = [
    { id: 'main', name: '片場主島', sub: '系必修・四年主線', color: '#F3B562' },
    { id: 'port', name: '入學港', sub: '通識核心', color: '#A7B4C2', ring: 0 },
    { id: 'college', name: '傳設學院島', sub: '院必修・院選修', color: '#7FA1C3', ring: 1 },
    { id: 'cam', role: 'cam', ring: 2 }, { id: 'art', role: 'art', ring: 3 }, { id: 'snd', role: 'snd', ring: 4 },
    { id: 'edt', role: 'edt', ring: 5 }, { id: 'res', role: 'res', ring: 6 }, { id: 'dir', role: 'dir', ring: 7 },
    { id: 'pro', role: 'pro', ring: 8 }, { id: 'mkt', role: 'mkt', ring: 9 },
    { id: 'sea', name: '博雅跨域外海', sub: '博雅選修・跨域選修', color: '#6FB7C9', ring: 10 },
  ];
  ISLANDS.forEach(i => { if (i.role) { const r = ROLES.find(x => x.id === i.role); i.name = r.island; i.sub = r.name + '專業選修'; i.color = r.color; } });

  // 每門課的裝備：[裝備名, emoji, 穿戴部位, 模型, tier, 所屬職務]
  // 部位 null＝收進背包的徽章；所屬職務也決定系選修放在哪座島
  // tier 4＝傳說道具：只有大四《畢業展演》給，紅毯走到山頂才拿得到
  const G = {
    // 通識
    A93A17: ['服務教育徽章', '🌱'], A93A18: ['志工感謝狀', '🫶'],
    A93A20: ['mBlock 小機器人', '🤖'], A93A21: ['地球儀徽章', '🌍'], A93A22: ['敘事筆記本', '📓'], A93A23: ['文案靈感本', '📒'],
    A93A28: ['保溫水壺', '🥤'], A93A29: ['智慧手錶', '⌚', 'wrist', 'watch', 1],
    A93A30: ['英語單字卡', '🔠'], A93A31: ['英語會話卡', '🗣️'], A93A32: ['英語筆記', '📮'], A93A33: ['英語證書夾', '💬'],
    A93A34: ['英文單字卡', '📇'], A93A35: ['創意產業英文徽章', '💬'], A93A36: ['思辨筆記本', '📓'],
    A93A15: ['運動鞋', '👟', 'feet', 'sneakers', 1], A93A16: ['運動毛巾', '🧺'],
    // 院
    A81814: ['繪圖板', '🖊️', 'handL', 'tablet', 1, 'art'], A81813: ['色票扇', '🌈', null, null, 0, 'art'],
    A81E01: ['傳播設計筆記', '🗞️', null, null, 0, 'mkt'], A81E0120: ['傳播設計筆記', '🗞️', null, null, 0, 'mkt'],
    A81724: ['Xplorer 探險帽', '🧭', 'head', 'explorer', 1, 'edt'],
    // 系必修
    A19021: ['悲喜劇面具', '🎭', 'handL', 'mask', 1, 'dir'], A19025: ['爆米花', '🍿', 'handR', 'popcorn', 0, 'res'],
    A19003: ['製作夾板', '📋', 'handL', 'clipboard', 1, 'pro'], A19024: ['手持攝影機', '📹', 'handR', 'camHand', 1, 'cam'],
    A19027: ['片場工作證', '🪪', 'neck', 'pass', 1, 'mkt'], A19002: ['老膠卷', '🎞️', null, null, 0, 'res'],
    A19035: ['監聽耳機', '🎧', 'ears', 'headphones', 1, 'snd'], A19028: ['劇本', '📜', 'handL', 'script', 1, 'dir'],
    A19011: ['剪輯筆電', '💻', 'handL', 'laptop', 1, 'edt'], A19032: ['導演取景器', '🔭', 'neck', 'viewfinder', 2, 'dir'],
    A19029: ['場記板', '🎬', 'handR', 'clapper', 1, 'dir'], A19030: ['對講機', '📻', 'handR', 'walkie', 1, 'pro'],
    A19522: ['調色盤', '🎨', 'handL', 'palette', 2, 'art'], A19017: ['宣傳手機', '📱', 'handR', 'phone', 1, 'mkt'],
    A19018: ['圓框眼鏡', '👓', 'eyes', 'glasses', 1, 'res'], A19031: ['導演擴音器', '📣', 'handR', 'megaphone', 2, 'dir'],
    A19521: ['VR 頭顯', '🥽', 'eyes', 'vr', 2, 'edt'], A19523: ['VR 頭顯', '🥽', 'eyes', 'vr', 2, 'edt'],
    A19033: ['導演椅', '🪑', 'prop', 'chair', 2, 'dir'], A19034: ['四季金膠卷', '🌟', 'aura', 'filmHalo', 4, 'mkt'],
    A19500: ['英語能力證明', '🔤'], A19501: ['資訊能力證明', '💾'], A19B98: ['跨域護照', '🛂'],
    // 導演組
    A19451: ['拉片筆記', '🗒️', null, null, 0, 'dir'], A19453: ['敘事結構圖', '🧵', null, null, 0, 'dir'],
    A19468: ['表演圍巾', '🧣', 'neck', 'scarf', 1, 'dir'], A19487: ['角色筆記', '📝', null, null, 0, 'dir'],
    A19404: ['分鏡本', '✏️', 'handL', 'storyboard', 2, 'dir'], A19462: ['戲服披風', '🦸', 'back', 'cape', 2, 'dir'],
    A19479: ['圍讀紅筆', '🖍️', null, null, 0, 'dir'], A19428: ['劇本手稿', '🖋️', null, null, 0, 'dir'],
    A19409: ['獨立製片徽章', '🎞️', null, null, 0, 'dir'], A19240: ['明星墨鏡', '🕶️', 'eyes', 'sunglasses', 2, 'dir'],
    A19443: ['導演貝雷帽', '🎨', 'head', 'beret', 2, 'dir'], A19445: ['劇本解析表', '📑', null, null, 0, 'dir'],
    A19449: ['提案簡報', '📊', null, null, 0, 'dir'], A19467: ['編劇鋼筆', '✒️', null, null, 0, 'dir'],
    A19477: ['選角卡', '🃏', null, null, 0, 'dir'], A19486: ['謝幕禮帽', '🎩', 'head', 'tophat', 3, 'dir'],
    A19431: ['歌舞劇禮帽', '🎩', 'head', 'tophat', 3, 'dir'], A19447: ['名劇劇本集', '🎼', null, null, 0, 'dir'],
    // 製片組
    A19437: ['製片耳麥', '🎤', 'ears', 'headset', 2, 'pro'], A19489: ['預算表', '💰', null, null, 0, 'pro'],
    A19490: ['通告單', '🗓️', null, null, 0, 'pro'], A19493: ['片場反光背心', '🦺', 'body', 'vest', 2, 'pro'],
    A19480: ['器材清單', '🧾', null, null, 0, 'pro'], A19481: ['拍攝排程板', '📅', null, null, 0, 'pro'],
    A19491: ['片廠鑰匙串', '🔑', 'belt', 'keys', 1, 'pro'], A19492: ['片廠門禁卡', '💳', null, null, 0, 'pro'],
    A19202: ['化妝刷', '🖌️', 'handR', 'brush', 1, 'art'], A19459: ['美術工作圍裙', '🪚', 'body', 'apron', 1, 'art'],
    A19303: ['實習公事包', '💼', 'handL', 'briefcase', 1, 'pro'], A19301: ['實習識別證', '🏢', null, null, 0, 'pro'],
    A19302: ['實習結業證', '🎫', null, null, 0, 'pro'], A19427: ['電影法規手冊', '🏛️', null, null, 0, 'pro'],
    // 攝影燈光組
    A19520: ['燈光工具腰帶', '🔦', 'belt', 'toolbelt', 1, 'cam'], A19494: ['攝影組反戴帽', '🧢', 'head', 'cap', 1, 'cam'],
    A19461: ['攝影組反戴帽', '🧢', 'head', 'cap', 1, 'cam'], A19411: ['肩扛電影機', '🎥', 'handR', 'camShoulder', 2, 'cam'],
    A19458: ['美術調色盤', '🖼️', 'handL', 'palette', 1, 'art'],
    // 聲音組
    A19441: ['聲畫節拍器', '🎼', null, null, 0, 'snd'], A19103: ['收音桿', '🎙️', 'handR', 'boom', 2, 'snd'],
    A19109: ['後製錄音包', '🎚️', 'belt', 'recorder', 2, 'snd'], A19457: ['混音錄音包', '🎚️', 'belt', 'recorder', 2, 'snd'],
    A19496: ['現場錄音包', '🎚️', 'belt', 'recorder', 2, 'snd'], A19239: ['肢體節奏鈴', '🤸', null, null, 0, 'snd'],
    // 剪輯組
    A19107: ['剪輯快捷鍵盤', '⌨️', null, null, 0, 'edt'], A19460: ['特效小無人機', '🛸', 'pet', 'drone', 2, 'edt'],
    A19525: ['AI 小無人機', '🛸', 'pet', 'drone', 2, 'edt'], A19450: ['新媒體徽章', '🌀', null, null, 0, 'edt'],
    A19418: ['調光控台', '🎛️', null, null, 0, 'edt'], A19497: ['Xplorer 探險帽', '🧭', 'head', 'explorer', 1, 'edt'],
    // 影視行銷
    A19452: ['小廚房廚師帽', '👨‍🍳', 'head', 'chefhat', 1, 'mkt'], A19454: ['健康風味菜單', '🥗', null, null, 0, 'mkt'],
    A19473: ['田野背包', '🎒', 'back', 'travelpack', 1, 'mkt'], A19474: ['饗宴廚師帽', '👨‍🍳', 'head', 'chefhat', 1, 'mkt'],
    A19484: ['旅行背包', '🎒', 'back', 'travelpack', 1, 'mkt'], A19482: ['宣傳手機', '📱', 'handR', 'phone', 1, 'mkt'],
    A19495: ['發行手機', '📱', 'handR', 'phone', 1, 'mkt'], A19483: ['業界名片夾', '🤝', null, null, 0, 'mkt'],
    // 影視研究
    A19210: ['文學書籤', '🔖', null, null, 0, 'res'], A19446: ['經典片單書', '📖', 'handL', 'book', 1, 'res'],
    A19419: ['亞洲影展手冊', '🏮', null, null, 0, 'res'], A19434: ['導演風格圖鑑', '🧐', null, null, 0, 'res'],
    A19448: ['文本放大鏡', '🔍', null, null, 0, 'res'], A19432: ['類型分類卡', '🗂️', null, null, 0, 'res'],
    A19439: ['研究筆記', '🔬', null, null, 0, 'res'], A19463: ['現代電影拼圖', '🧩', null, null, 0, 'res'],
    A19476: ['田野筆記', '🗺️', null, null, 0, 'res'], A19485: ['影展通行證', '🎟️', null, null, 0, 'res'],
    A19420: ['影評人軟呢帽', '👒', 'head', 'fedora', 2, 'res'], A19440: ['影評鋼筆', '✍️', null, null, 0, 'res'],
    A19475: ['原著小說', '📚', null, null, 0, 'res'],
  };
  const GEAR = {};
  Object.keys(G).forEach(k => { const g = G[k]; GEAR[k] = { n: g[0], e: g[1], slot: g[2] || null, m: g[3] || null, tier: g[4] || 0, role: g[5] || null }; });

  window.FILM = {
    meta: {
      dept: '義守大學 電影與電視學系',
      deptUrl: 'https://filmtv.isu.edu.tw/',
      planUrl: 'https://filmtv.isu.edu.tw/page/%E5%9B%9B%E5%B9%B4%E8%AA%B2%E7%A8%8B%E8%A8%88%E5%8A%83-TGFQncD9nj2K',
      developer: { name: '陳嘉暐老師', url: 'https://weisfx0705.github.io/chiawei/' },
    },
    ROLES, YEARS, ISLANDS, GEAR,
  };
})();
