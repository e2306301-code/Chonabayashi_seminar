# ちょなちょナゲット 注文管理アプリ

学祭の店頭iPadで注文を受け、パソコンで注文内容と受付番号1〜5を管理するブラウザアプリです。

## できること

- 日付別の味を選び、カップ数・個数・合計金額を自動計算
- 空いている受付番号1〜5を自動割り当て
- 5組受付中は新しい注文を停止
- 管理画面で「受付済み → 調理中 → 受け渡し待ち → 完了」を操作
- 完了・取消後に受付番号を再利用
- iPadとパソコンへリアルタイム反映
- 注文端末・管理者を別アカウントで保護

## 公開URL

- 注文端末：`https://e2306301-code.github.io/Chonabayashi_seminar/#/`
- 管理画面：`https://e2306301-code.github.io/Chonabayashi_seminar/#/admin`

公開前にFirebaseとGitHub Pagesの初期設定が必要です。手順は [Firebase・公開設定](docs/FIREBASE_SETUP.md) を上から順に進めてください。

## 開発用コマンド

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

秘密情報やパスワードはリポジトリへ保存しないでください。
