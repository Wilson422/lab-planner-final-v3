# Lab Planner Pro

實驗室空間規劃工具，提供：

- 2D 配置規劃
- 3D 預覽
- 設備 / 區域 / 牆體配置
- 安全距離與碰撞提示
- PNG / PDF / JSON 匯出

## GitHub Pages

預計網站網址：

- `https://wilson422.github.io/lab-planner-final-v3/`

目前已設定 GitHub Actions 自動部署流程：

- push 到 `main` 後會自動執行 `npm ci`
- 接著自動執行 `npm run build`
- build 完成後自動部署到 GitHub Pages

> 如果網址目前還打不開，通常是因為 PR 尚未合併到 `main`，或 GitHub Pages 還沒在 repository settings 內完成啟用。

## 直接在 GitHub 上作業

如果你不想下載到本機，可以直接使用以下方式：

1. 在 GitHub 網頁直接編輯檔案
2. 或使用 GitHub Codespaces 開發
3. 開新 branch 修改內容
4. 建立 Pull Request
5. 合併到 `main`
6. 等待 GitHub Actions 自動 build 與 deploy

## 建立 PR 後還要做什麼

不是只有 Create Pull Request 就全部完成，後面通常還要：

1. **確認 PR 已建立成功**
2. **把 PR merge 到 `main`**
3. **到 GitHub Actions 確認 workflow 跑成功**
4. **到 Settings → Pages 確認來源是 GitHub Actions**
5. **等待 GitHub Pages 更新網址內容**

也就是說：

- **只有建立 PR：還沒完成部署**
- **PR merge 到 `main`：才會觸發正式部署**

## 使用方式

### 規劃流程

1. 從左側元件庫選擇設備、區域或牆體
2. 在畫布上點擊放置
3. 拖曳調整位置
4. 檢查衝突與安全距離提示
5. 視需要切換 3D 預覽
6. 匯出 PNG / PDF / JSON

### 快捷操作

- `Shift`：多選
- `Delete`：刪除
- `Ctrl/Cmd + Z`：撤銷
- `Ctrl/Cmd + Y`：重做
- `Esc`：取消放置模式

### 資料保存

- 瀏覽器會自動保存目前規劃內容
- 也可手動匯出 / 匯入 JSON

## 部署說明

GitHub Actions workflow 位於：

- `.github/workflows/deploy.yml`

部署觸發條件：

- push 到 `main`
- 手動執行 workflow_dispatch
