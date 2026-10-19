# rpg-sprites

六職業、男女各一位，共 12 位角色。網站提供高清正常、高清 Q 版、48×48 Q 版像素圖與 96×96 Q 版像素圖。

## 素材來源

圖片使用 Codex 內建 imagegen 生成，沒有使用 API key、生成 CLI 或 SVG。工具未回傳實際模型版本，`generationModel` 保持 null。新版 Q 版採大頭、短身體、圓潤輪廓與柔和配色，保留各職業的膚色、髮型、配色和裝備特色。

- `generated/illustrations/`：既有高清正常版，完整保留。
- `generated/chibi/`：新增的高清 Q 版插畫，非像素圖。
- `generated/masters/chibi/`：依高清 Q 版生成的獨立像素風來源。
- `generated/prompts/chibi/`：各角色的 `_illustration.txt` 與 `_pixel.txt` 完整提示詞。
- `generated/samples/`：保留先前展示的女守火人 Q 版像素樣稿。
- `generated/masters/` 上層與其 `40/` 子目錄：先前正常比例像素來源，留存但不再用於網站輸出。
- `generated/manifest.json`：六職業共用名稱、描述、外貌特徵與持握規範。

高清正常版與高清 Q 版均直接複製原檔。像素版優先使用 Q 版像素來源；如有 `generated/masters/chibi/48/<id>.png`，48px 會使用該尺寸專用來源。

## 網站輸出

- `../public/characters/<id>.png`：48×48、最多 24 色、alpha 0/255，腳底基準 (24, 46)。
- `../public/characters/96/<id>.png`：96×96、最多 24 色、alpha 0/255，腳底基準 (48, 92)。
- `../public/characters/originals/`：高清正常版。
- `../public/characters/chibi/`：高清 Q 版。
- `../public/characters/previews/`：48px 的 6× 整數放大（288×288）。
- `../public/characters/previews/96/`：96px 的 3× 整數放大（288×288）。
- `../src/data/characters.json`：含兩套高清圖、像素尺寸、色盤、來源與雜湊的資料。
- `../public/characters/generation-report.json`：24 張像素圖的尺寸、色數、alpha、位置檢查紀錄。

兩種像素尺寸都從生成來源獨立 nearest-neighbor 取樣、無抖色量化；96px 不是放大的 48px。靜態像素圖未進行逐點手工精修；動作動畫另外使用下述來源。匯出會移除已知角色的舊 80px 網站輸出，保留無關檔案。

## 重建與驗證

從 repo root：

```bash
rpg-sprites/.venv/bin/python rpg-sprites/sprites.py doctor
rpg-sprites/.venv/bin/python rpg-sprites/sprites.py export-web
```

匯出只讀取已保存的來源，不呼叫生成服務。先完整驗證 12 位角色的兩套高清圖與像素來源，再寫入網站素材，避免缺檔時覆蓋現有輸出。

在 `rpg-sprites/` 執行：

```bash
uv sync
.venv/bin/python -m unittest discover -s tests
```

測試涵蓋六職業男女各一、48px／96px 尺寸、色數、透明度、腳底基準、兩套高清原檔完整保存、獨立的大尺寸取樣、重跑一致性與缺少來源時的保護。

守火人男女均為角色自身右手持劍（畫面左側）、左手持盾（畫面右側）。晨光使沿用 `sun_cleric` id。網站分享尺寸改為 `48`／`96`；舊 `40`／`80` 連結分別對應新尺寸。


## 動作 GIF

依 `../assets/actions.png` 範例，12 位 Q 版角色各有待機、走路、跑步、主攻擊、次攻擊、防禦、受傷、倒地 8 種動作，每種 4 個連續姿勢。弓箭手射箭、法師施法、格鬥家出拳；守火人使用劍盾，借影人使用雙匕首。

- `generated/animations/sheets/<id>.png`：內建 imagegen 生成的 4 欄 × 8 列動作表，含 32 個真實姿勢；不使用程式平移靜態人物來代替動作。
- `generated/animations/prompts/<id>.txt`：每位角色的完整生成提示詞。工具未提供模型版本。
- `../public/characters/animations/<48|96>/<id>/<action>.gif`：192 個原尺寸透明 GIF。
- 同目錄 `<action>-0.png` 到 `<action>-3.png`：逐格 PNG，也是網站播放器的影格來源。
- 同目錄 `sheet.png`：各尺寸的完整 4×8 像素動作表，包含所有動作。
- `../src/data/animations.json`：動作名稱、GIF、逐格圖、播放時間、來源與雜湊索引。
- `../public/characters/animations/generation-report.json`：來源與影格拆分檢查紀錄。

重建：

```bash
rpg-sprites/.venv/bin/python rpg-sprites/sprites.py export-animations
```

編碼程式只拆分已生成的姿勢、縮放與轉換格式。以透明區域的連通輪廓分離姿勢與特效，避免長劍或法術跨過格線時被裁切；每位角色共用同一縮放比例，每種動作共用基準位置，倒地影格不獨立放大。48px／96px 分別取樣；同一尺寸的 32 個影格共用最多 24 色，另留透明色索引。GIF 使用 disposal=2、背景透明、循環播放；倒地最後一格停留 900ms。

網站按同一套逐格 PNG 與 GIF 的時間表播放，因此可精確暫停與逐格檢查。尊重系統「減少動態效果」偏好，預設暫停；使用者可手動播放。網址支援 `view=animation&action=walk&size=96`。

匯出先驗證全部 12 張來源與 192 個 GIF，再寫入素材。測試確認完整角色／動作／尺寸覆蓋、4 格內容、透明度、色數、邊界、GIF 解碼後沒有殘影、播放時間，以及缺少來源時保留既有輸出。


## 高清正常與 Q 版動畫

12 位角色的兩套高清風格各有 8 種動作，共新增 192 個 512×512 GIF。高清正常維持原本成年英雄比例；高清 Q 版維持大頭短身比例。兩套均以內建 imagegen 重新生成平滑繪本插畫姿勢，工具未提供模型版本。

- `generated/hd-animations/sheets/<chibi|original>/<id>-<0..3>.png`：96 張來源，各為 4 欄 × 2 列（2 種動作 × 4 格），每格至少 384 個原生像素。
- `generated/hd-animations/prompts/`：對應的完整提示詞；`jobs.json` 保存角色、風格、動作對與來源規格。
- `../public/characters/animations/hd/<chibi|original>/<id>/<action>.gif`：512px 循環 GIF。
- 同目錄 `<action>-0.png` 到 `<action>-3.png`：全彩 RGBA 影格，保留抗鋸齒與柔和透明；`sheet.png` 是 2048×4096 的完整動作表。
- `../src/data/hd-animations.json`：兩種高清風格、GIF 與逐格 PNG 索引，PNG 擁有獨立雜湊避免色彩／透明度更新後快取過期。
- `../public/characters/animations/hd/generation-report.json`：來源大小、來源雜湊、實際縮放與輸出規格。

```bash
rpg-sprites/.venv/bin/python rpg-sprites/sprites.py export-hd-animations
```

輸出採每位角色共用的縮放與動作基準位置，512px 畫布不放大來源。PNG 全彩，GIF 每個動作共用 255 色加透明色，disposal=2。GIF 的二值透明遮罩必須與 PNG 的 alpha>=128 區域一致，避免殘影或黑色服裝消失。先完整驗證 24 套風格與 192 個 GIF，再寫入高清輸出；既有像素匯出獨立保留。

網站動畫風格參數為 `art=pixel|chibi|original`。高清以一般圖片縮放顯示，像素版使用整數倍率；三種風格均可播放、暫停、逐格查看與下載。

高清待機匯出會匹配頭部與上半身，校正原圖人物間距不均造成的漂移；Q 版跑步（含掌燈人）只校正水平位移，保留上下起伏。畫稿修正、提示詞與來源雜湊見 [動畫 review](generated/hd-animations/review/README.md)。

## 怪物素材

三隻怪物與角色使用相同的圖像規格，獨立保存於 `generated/monsters/`：

| id | 名稱 | 屬性 | 定位 |
| --- | --- | --- | --- |
| `moondew_slime` | 月露史萊姆 | 月 | 小怪 |
| `mossrock_grunt` | 苔岩小怪 | 地 | 小怪 |
| `eclipse_treant` | 蝕光樹靈 | 影 | Boss |

- `chibi/`、`original/`：透明高清 Q 版與正常比例原稿；不縮小原檔。
- `masters/chibi/`：獨立生成的像素風來源，並非把高清插畫直接縮小。
- `animations/sheets/`：4 欄 × 8 列的像素動作來源，每動作 4 個真實生成姿勢。
- `hd-animations/sheets/<chibi|original>/`：每隻每種風格 4 張 4×2 動作來源，至少 384 個原生像素／格；不放大來源。
- `prompts/`、`animations/prompts/`、`hd-animations/prompts/`：保留提示詞；`jobs.json` 記錄來源與對應提示詞。
- `manifest.json`：名稱、屬性、描述與各怪物的動作名稱；沒有性別變體。

```bash
python rpg-sprites/sprites.py export-monsters
```

指令重用角色的輪廓拆格、色盤、位置對齊及 GIF 編碼器，在所有來源驗證成功後才寫入。輸出至 `public/monsters/` 與 `src/data/monsters.json`，包含：

- 6 張高清原檔、6 張 48／96px 像素圖、6 張整數倍預覽與 2 張像素總覽。
- **96 個 GIF**：3 隻 × 8 動作 × 4 規格（48、96、高清 Q 版、高清正常）。
- **384 張逐格 PNG**、12 張完整動作表與生成報告。
- 像素最多 24 色、二值透明；高清 PNG 全彩 RGBA，GIF 255 色加透明色。所有 GIF 使用 disposal=2，倒地末格停留 900ms。

`slash`／`thrust` 保留為共用動作 id，顯示名稱依怪物改為撞擊、重拳、揮枝、魔法攻擊等。網站 `/monsters` 可切換怪物與風格、播放／暫停、逐格查看及下載；`prefers-reduced-motion` 預設暫停。這批只提供素材及圖鑑，尚未接入戰鬥數值或遊戲邏輯。

素材使用內建 imagegen，工具未提供實際模型版本，因此 `model`／`generationModel` 為 null，不宣稱使用特定模型版本。與人物一樣，像素素材是生成來源再取樣，尚未逐點手工精修。
