# モックサーバー（手元テスト用）

Apps Script＋スプレッドシートを Google 側に作る前に、Mac 上で送信〜通知〜一覧までの流れを確認するためのもの。実患者データは扱わない。

## 起動

```bash
# nvm の Node を使う場合
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
node tools/mock-server/server.mjs          # http://localhost:8787
cd patient-pwa && npx vite --host          # http://localhost:5173（同じ Wi-Fi のスマホからは http://<Mac の IP>:5173）
```

`patient-pwa/.env` の `VITE_API_URL` が `http://<Mac の IP>:8787` を指していること。

## テスト患者

| 番号 | 暗証番号 | メニュー |
|---|---|---|
| 9001 | 0000 | 1（標準） |
| 9002 | 1111 | 2（低体力） |

PWA の初期設定画面で番号と暗証番号を入力する。

## 見るところ

- ブラウザで http://localhost:8787 を開くとダッシュボード（患者一覧・即時通知・日次記録）。15 秒ごとに自動更新
- サーバーのターミナルにも通知内容が表示される（実運用ではこれがメールになる）
- 受信データは `logs.jsonl`、通知は `notifications.jsonl` に追記される。消せば初期化

## 本番との違い

- 実運用の Apps Script（`apps-script/Code.gs`）と同じ検証（番号＋暗証番号の SHA-256 照合、連続失敗ロック、status、verify）と通知条件を実装している
- 同日再送の上書き、朝のまとめ、週次はモックでは省略
