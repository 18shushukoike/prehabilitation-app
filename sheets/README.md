# スプレッドシート雛形（タブ・列定義）

`setupSheets` を実行すると以下のタブが自動で作られる。ここでは各タブの意味と運用上の注意を記す。

**このシートには研究 ID・患者の入力・対応記録・運用情報だけを置く。** 患者の識別情報（氏名・病院 ID・生年月日・連絡先）と臨床データ（レジメン、NAC 開始日、外来日、握力・SPPB 等の評価値、手術関連）は REDCap 等の院内管理システムで研究 ID に紐づけて管理し、ここには書かない。

## タブ一覧

| タブ | 更新者 | 保護 |
|---|---|---|
| 患者一覧 | 医療者 | `pin_hash` 列のみ管理者 |
| 日次記録 | Apps Script | シート全体（閲覧のみ） |
| 対応記録 | 医療者 | なし |
| 全体サマリー | Apps Script | シート全体（閲覧のみ） |
| 進捗_番号（患者ごと） | Apps Script | シート全体（閲覧のみ） |
| 通知ログ | Apps Script | シート全体（閲覧のみ） |
| 設定 | 管理者 | なし |

## 患者一覧

| 列 | 入力 | 説明 |
|---|---|---|
| study_id | 必須 | 4 桁の番号（1001〜）。発行ツールが出力する。列は文字列書式（先頭ゼロを保つ） |
| pin_hash | 必須 | 発行ツールが出力する SHA-256(番号:暗証番号)（64 文字）。暗証番号そのものはカードにのみ印字され、ここには書かない |
| menu_template | 必須 | 1=標準 2=低体力 3=神経障害あり（初期設定時にアプリへ返される） |
| assignee_pt | 任意 | 担当理学療法士の大学メール。即時通知の宛先に加わる |
| assignee_dr | 任意 | 担当医の大学メール。同上 |
| status | 必須 | `active` / `inactive`（端末紛失・中断）/ `operated` / `withdrawn`。`active` 以外は送信を受け付けない |
| note | 任意 | 運用メモ（例: 家族が代理入力）。**氏名・病院 ID・臨床情報を書かない** |

発行ツール（`tools/id-generator/index.html`）が「患者一覧に貼り付ける行」をタブ区切りで出力するので、A 列の空行にそのまま貼り付ける。

## 日次記録（自動）

README §8.1 の列定義のとおり（`walk_status` / `walk_min` / `pre_check` / `pre_symptoms` / `pre_symptom_text` / `session_planned` / `session_days` / `session_status` / `session_type` / `session_min` / `session_items_done` / `reasons` / `post_borg` / `post_condition` / `post_symptoms` …）。`pre_symptoms`・`reasons`・`post_symptoms`・`session_items_done` はコードで保存され、全体サマリー・日次シート・通知メールでは日本語に変換される。手動で編集しない。訂正が必要な場合は患者に再送信してもらう（同日分は上書きされる）。

列構成を変更したときは「日次記録」「全体サマリー」「進捗_*」タブを削除してから `setupSheets` を再実行する（既存データがある場合は先に CSV でバックアップ）。

## 対応記録

| 列 | 説明 |
|---|---|
| ts | 対応日時 |
| study_id | |
| staff | 対応者（氏名または大学メール） |
| channel | `phone` / `outpatient` / `none`（確認のみで連絡不要と判断した場合） |
| trigger | 通知の要約（例: 連絡希望、未送信 3 日） |
| content | 伝えた内容・患者の状況 |
| next_action | 次回対応（例: 次回外来で再評価、栄養士に相談） |
| chart_noted | 電子カルテに記載したか（TRUE/FALSE） |

**重要な所見（赤信号での中止、運動後の症状、休止指示）は電子カルテにも必ず記載し、`chart_noted` を TRUE にする。**

## 全体サマリー（自動、毎時＋受信時に更新）

**症例ごとに 1 行**で、その患者の全期間の累積を並べる。最終行は「全体」の合計行。列は次のとおり。

| 列 | 意味 |
|---|---|
| study_id / status | 番号、状態 |
| first_log / last_log / days_logged | 最初と最後の送信日、送信日数 |
| planned_days / planned_done / planned_adherence_pct / planned_missed | 予定日の記録数、予定日にセッションした回数（した＋一部）、遂行率 %、予定日に未実施 |
| sessions_total / sessions_full / sessions_partial / sessions_unplanned | セッション総回数、した、一部、予定外の日の実施 |
| sessions_normal / sessions_mild / mean_session_min | 通常メニュー回数、軽いメニュー回数、平均所要時間 |
| checks / green / yellow / red / *_pct | 運動前の判定回数と青・黄・赤の回数・割合 |
| red_items / yellow_items | 赤・黄で選ばれた項目の内訳（多い順） |
| post_records / post_fine / post_tired / post_symptom / post_symptom_pct / post_symptom_items | 運動後の記録回数、問題なし、少しつらかった、症状あり（回数・割合・内訳） |
| mean_borg | 運動後の平均 Borg |
| walk_days / walk_pct / mean_walk_min / walk_total_min | 歩いた日数、割合、歩いた日の平均分数、合計分数 |
| reason_items | できなかった理由の内訳 |
| days_since_log / session_days / sessions_this_week / planned_this_week / consecutive_no_exercise | 現在の状況: 未送信日数、設定曜日、今週のセッション回数、経過した予定日数、運動なしの連続日数 |
| needs_contact / reason_for_contact | 要連絡（未送信 ≥2 日／予定日が経過して今週セッション 0 回／運動なし 3 日連続／赤信号で中止／運動後に症状）。行が赤く強調される |

## 進捗_番号（患者ごとに 1 タブ、自動、毎時＋受信時に更新）

セッションができたかどうかを **1 日 1 行** で追う。最初の送信日から今日までの全日を並べ、未送信の日も行を作る（最新日が上）。

上部 2 行: 番号、状態、担当医、担当 PT、設定曜日、今週セッション（回数／目標、経過した予定日数）、最終送信、要連絡（理由）。

| 列 | 意味 |
|---|---|
| 日付 / 曜日 / 予定日 | 予定日は患者が設定した曜日に ○ |
| 送信 | 送信／未送信 |
| 信号 / 信号の項目 / 本人の記載 | セッション前の体調確認（開かなかった日は空） |
| セッション / メニュー / 所要時間(分) / 実施種目 | した・一部だけした・できなかった・予定なし、通常・軽い、分、「できた」を押した種目数 |
| 歩行 / 歩行(分) | 歩いた・歩かなかった・休む日 |
| できなかった理由 | |
| 運動後の体調 / 運動後の症状 / Borg | |
| ひとこと / 受信日時 | |

行の背景色: 赤＝赤信号で中止、橙＝運動後に症状、黄＝黄信号、緑＝セッション実施、薄赤＝予定日に未実施、灰＝未送信。

患者一覧に番号を追加すると次回の再計算でタブが自動生成される。患者一覧から削除してもタブは残るので、不要なら手動で削除する。

## 設定

| key | 既定 | 説明 |
|---|---|---|
| notify_emails | （空） | 即時通知の共通宛先。担当者列のメールにも送られる |
| summary_emails | （空） | 朝のまとめ・週次の宛先。空なら notify_emails |
| no_input_days | 2 | 未送信何日で要連絡か |
| sessions_per_week | 3 | 週あたりのセッション目標回数 |
| consecutive_no_exercise_days | 3 | セッションも歩行もない日が何日続いたら要連絡か |
| rate_limit_per_min | 10 | 番号ごとの 1 分あたり受信上限 |
| lock_after_failures | 10 | 暗証番号の連続失敗が何回でロックするか |
| lock_hours | 6 | ロック時間 |
| immediate_notify | true | 即時通知（赤信号・運動後の症状）を送るか。false にすると朝のまとめのみ |
| subject_prefix | [術前リハ] | メール件名の接頭辞 |

## 月次バックアップ

月 1 回、**ファイル → ダウンロード → CSV** で「日次記録」「対応記録」を院内 PC に保存する。
