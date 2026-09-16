# 患者向け PWA

Vite + React + TypeScript。患者データは端末内（localStorage）と Apps Script への送信のみ。サーバーは持たない。

## 開発

```bash
cp .env.example .env    # VITE_API_URL・病院電話番号を設定
npm install
npm run dev             # http://localhost:5173
```

スマートフォン実機で試す場合は `npm run dev -- --host` で同じ Wi-Fi から開く（モックサーバーは `tools/mock-server/`）。

## ビルド・公開

```bash
npm run build           # dist/ に静的ファイル
```

### GitHub Pages に置く場合

1. GitHub のプライベートリポジトリに push（Pages はプライベートリポジトリからも公開できる）
2. `.env` の `VITE_BASE` をリポジトリ名に合わせる（例: `/prehab-app/`）
3. `dist/` を `gh-pages` ブランチに置くか、GitHub Actions で自動デプロイ
4. 公開 URL を患者向けの案内（紙・短縮 URL）に使う

学内 Web サーバーに置く場合は `dist/` をそのままコピーし、`VITE_BASE` をそのパスに合わせる。

## 設定値（.env）

| 変数 | 内容 |
|---|---|
| VITE_API_URL | Apps Script ウェブアプリの URL |
| VITE_HOSPITAL_PHONE | 患者向けに表示する電話番号 |
| VITE_HOSPITAL_NAME | 表示名（例: 順天堂医院 肝胆膵外科外来） |
| VITE_BASE | 配置パス（ルートなら `/`） |

## 構成

```
src/
├── App.tsx              画面の切り替え・送信・未送信の再送
├── lib/
│   ├── api.ts           Apps Script への POST（text/plain）
│   ├── storage.ts       localStorage（設定・履歴・未送信キュー）
│   ├── config.ts        .env の読み込み
│   └── types.ts
├── data/
│   ├── exercises.ts     運動マスタ（動画 URL はここに入れる）
│   ├── program.ts       プログラム定義（週 3 回セッションのブロック構成、テンプレート 1〜3）
│   └── content.ts       理由・症状・中止基準・Borg・教育記事
├── screens/             Setup / Home / Session / Exercise / LogForm / History / Learn / Settings
└── components/          Video
```

## 動画の入れ方

`src/data/exercises.ts` の `videoUrl` に埋め込み URL を入れる。

- YouTube 限定公開: `https://www.youtube.com/embed/<動画ID>?rel=0`
- Google Drive（大学アカウント、リンクを知っている全員が閲覧可）: `https://drive.google.com/file/d/<ファイルID>/preview`

## 患者端末での初期設定（入院時にスタッフが行う）

1. 患者のスマートフォンのブラウザで PWA の URL を開く（URL は短縮 URL や紙の案内で渡す）
2. **ホーム画面に追加**（iOS: 共有 → ホーム画面に追加。Android: メニュー → ホーム画面に追加／インストール）
3. ホーム画面のアイコンから開き、カードの **番号（4 桁）と暗証番号（4 桁）** を入力して「設定する」。サーバーで照合され、メニューの種類が設定される
4. 「今日の記録を送る」でテスト送信し、スプレッドシートに行が入ることを確認する（テスト行は削除してよい）
5. 「設定」で文字の大きさを患者に合わせる。運動時間をスマートフォンのアラームに登録する

iOS では Safari とホーム画面のアプリで保存領域が別なので、**必ずホーム画面から開いたアプリで番号を入力する**。

## 制限事項

- アプリからの自動リマインド通知は持たない（サーバーを持たない設計のため）。スマートフォンのアラーム機能で代用する
- 歩数の自動取得は行わない
- 医療者からのアプリ内メッセージは持たない（電話・外来で行う）
