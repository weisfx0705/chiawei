# Zoom H4n／H4essential 錄音實務自學頁

義守大學電影與電視學系《影視錄音實務》教材，協助學生在拍攝現場辨識錄音機、確認輸入、監聽、錄音與交付檔案。

## 使用入口

| 頁面 | 內容 |
| --- | --- |
| [H4n 操作指南](h4n.html) | 機身按鍵、電源與 SD 卡、輸入設定、監聽與錄音差異、回放、速查卡及教學影片 |
| [H4essential 使用指南](h4essential.html) | 機身與接線、現場六步驟、輸入與檔案配置、音量觀念、電源及錄音檢查表 |

兩頁可以互相切換。依手上機型閱讀；兩款機器的操作與設定各有差異。

## 本機預覽

在儲存庫根目錄執行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8765/sound_class/h4n_eseential/h4n.html`，或將最後檔名換成 `h4essential.html`。按 Ctrl+C 停止預覽。

純靜態 HTML，無須安裝套件或建置；本機圖片與圖解放在 `assets/`。H4n 的 YouTube 教學影片與外部原廠手冊需要連網。

## 檔案與來源

- `h4n.html`、`h4essential.html`：各機型的教材、樣式與互動。
- `assets/`：H4essential 手冊圖像；`assets/h4n/`：H4n 手冊圖像。
- `h4n_episode3_corrected_transcript.txt`：H4n 教學影片的校訂逐字稿。

教材引用 Zoom 原廠手冊、補充手冊與教學影片；來源連結保留在各頁頁尾。圖像作教學引用，請保留原有來源說明。操作時也應核對實機韌體與對應手冊。

資料夾名稱 `h4n_eseential` 是既有網址的一部分，維護時請保留拼字與相對路徑。

[返回聲音課程說明](../README.md) · [影視錄音實務入口](../index2.html)
