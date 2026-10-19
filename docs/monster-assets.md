# 三隻怪物完整素材

提供月露史萊姆（月）、苔岩小怪（地）和蝕光樹靈（影屬性 Boss），延續人物的高清正常、高清 Q 版、48px／96px 像素與八種動作規格，讓後續戰鬥原型能直接取用素材。

## 素材與檔案

- `rpg-sprites/generated/monsters/` 保存高清原稿、獨立像素來源、像素動作來源、24 張高清動作來源，以及完整提示詞、參考圖與 jobs 索引。實際模型版本未回傳，保持 null。
- `public/monsters/` 提供 6 張高清原圖、6 張像素圖、6 張放大預覽、2 張總覽、96 個 GIF、384 張逐格 PNG、12 張完整動作表及生成報告。
- `src/data/monsters.json` 記錄名稱、屬性、造型、動作、時間表、來源與檔案雜湊。
- `python rpg-sprites/sprites.py export-monsters` 使用既有編碼器重建；完整驗證來源與 GIF 解碼後才寫入。
- `/monsters` 圖鑑可比較造型，播放、暫停、逐格查看及下載；尊重減少動態效果偏好。

此變更提供怪物素材與圖鑑，未加入戰鬥、數值平衡、技能效果或存檔。

## 驗證

- `npm run lint`：通過。
- `npm run build`：通過，含 TypeScript 型別檢查；Vite 仍提示有大於 500kB 的 JS chunk。
- `cd rpg-sprites && python -m unittest discover -s tests`：17 項通過，包括原有人物匯出與新增怪物素材測試。
- 怪物測試逐一解碼 96 個 GIF，檢查 384 張 PNG 的尺寸、色數、透明遮罩、邊界、不同姿勢、時間表與雜湊。
- 已查看像素總覽；自動瀏覽器 UI 檢查未完成：環境沒有 Chrome，Playwright 下載回傳不完整的壓縮檔。

## 素材使用

八種共用動作 id 為 `idle`、`walk`、`run`、`slash`、`thrust`、`block`、`hurt`、`fall`。兩種攻擊的名稱依怪物調整，請使用索引中的 label；`slash` 不表示怪物持劍。每動作 4 格，倒地末格停留 900ms。像素版以整數倍率顯示；高清版維持平滑縮放。

部署需將 `/monsters` 回退到 `index.html`。素材為生成後的初版，尚未逐點手工精修像素。
