# Firebase・GitHub Pages 初期設定

この設定は公開前に一度だけ行います。パスワードやFirebaseの秘密鍵をGitHubのファイルへ直接書かないでください。

## 1. Firebaseプロジェクトを作る

1. [Firebase Console](https://console.firebase.google.com/)を開きます。
2. 「プロジェクトを作成」を押します。
3. 分かりやすい名前（例：`chonacho-nugget`）を入力します。
4. Google Analyticsはこの注文アプリでは不要なので、無効でも構いません。

## 2. Webアプリを登録する

1. 作成したFirebaseプロジェクトを開きます。
2. プロジェクト概要の `</>`（ウェブ）を押します。
3. アプリ名に「ちょなちょ注文」などを入力して登録します。
4. 表示された `firebaseConfig` の次の6項目を控えます。

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## 3. ログイン機能を有効にする

1. Firebase Consoleの「構築」→「Authentication」を開きます。
2. 「始める」→「ログイン方法」→「メール／パスワード」を有効にします。
3. 「ユーザー」タブで次の2アカウントを作ります。

- 注文端末用：店舗iPadだけで使用
- 管理者用：注文管理パソコンだけで使用

各アカウントの「ユーザーUID」を控えます。パスワードは運営メンバー以外へ共有しないでください。

4. Authenticationの「設定」→「承認済みドメイン」に `e2306301-code.github.io` を追加します。

## 4. Firestoreを作る

1. 「構築」→「Firestore Database」→「データベースの作成」を押します。
2. 「本番環境モード」を選びます。
3. ロケーションは利用場所に近いものを選びます。作成後は変更できないため確認してから進めます。

## 5. 2つのアカウントへ役割を設定する

1. Firestoreの「データ」タブで「コレクションを開始」を押します。
2. コレクションIDを `users` にします。
3. 注文端末用ユーザーのUIDをドキュメントIDとして入力します。
4. フィールド名 `role`、種類「string」、値 `kiosk` を保存します。
5. 同じ `users` コレクションに管理者用UIDのドキュメントを追加します。
6. 管理者はフィールド名 `role`、種類「string」、値 `admin` を保存します。

大文字・小文字を含め、`kiosk` と `admin` をそのまま入力してください。

## 6. データの安全ルールを公開する

1. Firestoreの「ルール」タブを開きます。
2. このリポジトリの `firestore.rules` の内容をすべてコピーします。
3. ルール画面へ貼り付け、「公開」を押します。

このルールにより、注文端末は新規注文だけ、管理者は状態変更だけを行えます。未ログインの端末は注文データへアクセスできません。

## 7. GitHubへFirebase設定を登録する

1. GitHubで `e2306301-code/Chonabayashi_seminar` を開きます。
2. 「Settings」→「Secrets and variables」→「Actions」→「Variables」を開きます。
3. 「New repository variable」から次の6件を登録します。

| GitHubの変数名 | Firebaseで控えた値 |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

FirebaseのWeb設定値はブラウザアプリで利用する識別情報です。管理者パスワードや秘密鍵は登録しないでください。

## 8. GitHub Pagesを有効にする

1. GitHubリポジトリの「Settings」→「Pages」を開きます。
2. 「Build and deployment」のSourceで「GitHub Actions」を選びます。
3. `main` ブランチへファイルを送信すると、「Actions」タブでテストと公開が自動実行されます。
4. 完了後、次のURLを開きます。

- 注文端末：<https://e2306301-code.github.io/Chonabayashi_seminar/#/>
- 管理画面：<https://e2306301-code.github.io/Chonabayashi_seminar/#/admin>

## 9. 最初の起動

1. 先にパソコンで管理画面を開き、管理者用アカウントでログインします。
2. 最初の管理者ログイン時に受付番号1〜10の保存領域が自動作成されます。
3. 管理画面上部で「10月11日」または「10月12日」を選びます。
4. iPadで注文端末URLを開き、注文端末用アカウントでログインします。
5. Safariの共有ボタン→「ホーム画面に追加」を選ぶと、アプリのように起動できます。

## 10. 開催前の確認

- iPadで1カップ注文し、300円・4個と表示される
- パソコンへ同じ味・カップ数・受付番号が表示される
- 「受け取り完了」または「取消」が操作できる
- 完了・取消済みの注文履歴を1件ずつ削除できる
- 完了後に同じ受付番号が新しい注文で再利用される
- 10件注文すると11件目が停止する
- iPadを再読み込みしてもログインが維持される
- Wi-Fiを一時的に切った際、注文が受付済みと誤表示されない

本番前に、実際に使用するiPadとパソコンで一連の操作を必ず確認してください。
