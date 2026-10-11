# 注文・会計・売上管理機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 店頭iPadで注文と支払い方法を確定し、受付番号の発行と売上登録を同時に行い、管理画面で注文と売上を管理できるようにする。

**Architecture:** 注文、売上、受付枠を同じ会計IDで結び、一つのFirestoreトランザクションで保存する。売上集計とCSV生成は副作用のないドメイン関数へ分離し、管理画面は注文管理と売上管理の二つのタブで表示する。

**Tech Stack:** React 19、TypeScript 5.9、Firebase Authentication / Firestore、Vitest、Testing Library、Vite

**Spec:** `docs/superpowers/specs/2026-10-11-pos-sales-design.md`

## Global Constraints

- 1カップは4個入り、税込300円。
- 支払い方法は現金またはPayPayの一つだけで、PayPayは想定売上として記録する。
- 受付番号は1〜10で、空いている最小番号を割り当てる。
- 完全なオフライン動作、預かり金・お釣り、レジ締め、割引、複数支払い、在庫管理は追加しない。
- 売上は削除せず、取消状態にして集計から除外する。
- 注文履歴を削除しても売上記録は残す。
- 日時表示とCSVは日本時間（Asia/Tokyo）に統一する。
- 既存の注文状態 `cooking` と `ready` は読み取り互換のみ維持する。

## Review Focus

- 登録ボタンの連打や通信応答消失でも、同じ会計IDの注文・売上が二重作成されないこと（Task 2）。
- 10枠が埋まった時は注文、売上、受付枠のいずれも作成されないこと（Task 2）。
- 売上取消時に、受付中なら注文と枠も閉じ、完了済みなら売上だけを取り消すこと（Task 2、Task 4）。
- 取消済み、0件、日付切替の集計と味別割合が正しく、注文履歴50件制限の影響を受けないこと（Task 1、Task 4）。
- 登録失敗時に入力と支払い方法を保持し、受付番号を表示しないこと（Task 3）。

---

### Task 1: 売上型、集計、CSVのドメイン機能

**Files:**
- Create: `src/domain/sales.ts`
- Create: `src/domain/sales.test.ts`
- Modify: `src/firebase/types.ts`

**Interfaces:**
- Consumes: `OrderItem`、`OrderTotals`、`MenuDay`、`FlavorId`。
- Produces: `PaymentMethod`、`SaleStatus`、`SaleRecord`、`SalesPeriod`、`summarizeSales(sales, period)`、`createSalesCsv(sales, period)`、`PAYMENT_METHOD_LABELS`。

- [ ] **Step 1: 集計とCSVの失敗テストを書く**

  `summarizeSales` が日別・2日間を絞り、取消済みを除外して総額、現金、想定PayPay、件数、カップ数、全味の割合を返すこと、0件では全割合が0になることを検証する。`createSalesCsv` が取消済みを含み、UTF-8 BOM、指定列、日本時間を出力することを検証する。

- [ ] **Step 2: 対象テストが未実装で失敗することを確認する**

  Run: `pnpm test -- src/domain/sales.test.ts`
  Expected: FAIL because `sales.ts` does not exist.

- [ ] **Step 3: 売上型と純粋関数を実装する**

  `PaymentMethod = 'cash' | 'paypay'`、`SaleStatus = 'recorded' | 'cancelled'` とし、`SaleRecord` は設計書の全フィールドを持つ。集計対象期間は `'day11' | 'day12' | 'all'` とする。

- [ ] **Step 4: ドメインテストを通す**

  Run: `pnpm test -- src/domain/sales.test.ts`
  Expected: PASS.

- [ ] **Step 5: 変更をコミットする**

  Run: `git add src/domain/sales.ts src/domain/sales.test.ts src/firebase/types.ts && git commit -m "feat: add sales reporting domain"`

### Task 2: 会計トランザクション、取消、Firestore権限

**Files:**
- Modify: `src/domain/order.ts`
- Modify: `src/firebase/orderStore.ts`
- Modify: `src/firebase/orderStore.test.ts`
- Modify: `src/firebase/rules-model.test.ts`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: Task 1の`PaymentMethod`、`SaleRecord`。
- Produces: `CheckoutDraft`、`CheckoutReservation`、`registerCheckout(draft, persistence?)`、`observeSales(callback, onError?)`、`cancelSale(sale)`。既存の`createOrder`呼び出しは`registerCheckout`へ置換する。

- [ ] **Step 1: 会計ID、支払い方法、売上取消の失敗テストを書く**

  支払い方法なしを拒否すること、同じ`checkoutId`を永続化層へ渡すこと、全枠時に失敗すること、注文取消が対応売上も取り消す契約、権限モデルでkioskは会計作成のみ・adminは売上参照と取消のみ可能なことを検証する。

- [ ] **Step 2: 対象テストの失敗を確認する**

  Run: `pnpm test -- src/firebase/orderStore.test.ts src/firebase/rules-model.test.ts`
  Expected: FAIL on missing checkout and sales interfaces.

- [ ] **Step 3: 原子的な会計登録と売上購読・取消を実装する**

  `orders/{checkoutId}`、`sales/{checkoutId}`、`slots/{ticketNumber}`を一つの`runTransaction`で作成する。既存IDがあれば同じ受付番号を返して冪等にし、空き枠がなければ何も書かず`FullCapacityError`にする。`observeSales`は件数制限なしで全件を購読する。注文取消と売上画面からの取消は一つのトランザクションで整合させる。

- [ ] **Step 4: Firestoreルールを会計モデルへ更新する**

  kioskの注文・売上・枠作成を相互参照で検証し、adminは売上の`status`と`cancelledAt`以外の金額・明細・支払い方法を書き換えられないようにする。売上削除は禁止し、注文履歴削除は完了・取消のみ許可する。

- [ ] **Step 5: 永続化と権限モデルのテストを通す**

  Run: `pnpm test -- src/firebase/orderStore.test.ts src/firebase/rules-model.test.ts`
  Expected: PASS.

- [ ] **Step 6: 変更をコミットする**

  Run: `git add src/domain/order.ts src/firebase/orderStore.ts src/firebase/orderStore.test.ts src/firebase/rules-model.test.ts firestore.rules && git commit -m "feat: register orders and sales atomically"`

### Task 3: iPadの注文確認・支払い選択・受付番号発行

**Files:**
- Modify: `src/components/OrderSummary.tsx`
- Modify: `src/screens/KioskScreen.tsx`
- Modify: `src/screens/KioskScreen.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Task 2の`CheckoutDraft`、`CheckoutReservation`と`registerCheckout`互換コールバック。
- Produces: `KioskScreen`から`onSubmit({ checkoutId, menuDay, items, paymentMethod })`を一度だけ呼ぶ3段階画面（選択、確認・支払い、受付番号）。

- [ ] **Step 1: 新しい会計フローの失敗テストを書く**

  「お会計へ」では保存せず確認画面へ進むこと、現金またはPayPay選択後だけ登録できること、注文内容へ戻って修正できること、二重タップを一回に抑えること、登録成功後の「次の注文へ」で全状態が消えることを検証する。

- [ ] **Step 2: 通信失敗と満席の失敗テストを書く**

  登録失敗時に確認画面、注文、支払い方法を保持し受付番号を出さないこと、10枠満席では会計開始できないことを検証する。

- [ ] **Step 3: Kiosk画面テストの失敗を確認する**

  Run: `pnpm test -- src/screens/KioskScreen.test.tsx`
  Expected: FAIL because checkout review and payment controls are absent.

- [ ] **Step 4: 3段階の会計UIと状態初期化を実装する**

  会計開始時に`crypto.randomUUID()`で会計IDを一度だけ生成し、再試行では再利用する。登録中は操作を無効化し、成功するまで受付番号を表示しない。

- [ ] **Step 5: Kiosk画面テストを通す**

  Run: `pnpm test -- src/screens/KioskScreen.test.tsx`
  Expected: PASS.

- [ ] **Step 6: 変更をコミットする**

  Run: `git add src/components/OrderSummary.tsx src/screens/KioskScreen.tsx src/screens/KioskScreen.test.tsx src/styles.css && git commit -m "feat: add kiosk checkout flow"`

### Task 4: 管理画面の売上タブ、取消、CSV

**Files:**
- Create: `src/components/SalesDashboard.tsx`
- Create: `src/components/SalesDashboard.test.tsx`
- Modify: `src/components/OrderCard.tsx`
- Modify: `src/screens/AdminScreen.tsx`
- Modify: `src/screens/AdminScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Task 1の集計・CSV関数とTask 2の`observeSales`、`cancelSale`。
- Produces: 管理画面の`注文管理`／`売上管理`タブ、日付範囲切替、集計カード、味別割合、売上履歴、売上取消、CSVダウンロード。

- [ ] **Step 1: 売上ダッシュボードの失敗テストを書く**

  集計カード、現金・想定PayPay、味別カップ数と割合、日付切替、取消済み表示、確認後の売上取消、CSVダウンロードを検証する。

- [ ] **Step 2: 注文管理との連携の失敗テストを書く**

  注文カードに支払い方法を表示し、注文取消で対応売上も取消されるコールバックを呼ぶこと、履歴削除確認に「売上記録は削除されません」を表示すること、売上タブの日付切替が店舗のメニュー日を変更しないことを検証する。

- [ ] **Step 3: 管理画面テストの失敗を確認する**

  Run: `pnpm test -- src/components/SalesDashboard.test.tsx src/screens/AdminScreen.test.tsx`
  Expected: FAIL because sales dashboard and tabs are absent.

- [ ] **Step 4: 売上ダッシュボードと管理タブを実装する**

  `App`ではadminだけ全売上を購読する。CSVは選択期間の全売上からブラウザ内でBlobを作ってダウンロードし、売上画面の日付状態は`activeMenuDay`と分離する。

- [ ] **Step 5: 管理画面テストを通す**

  Run: `pnpm test -- src/components/SalesDashboard.test.tsx src/screens/AdminScreen.test.tsx`
  Expected: PASS.

- [ ] **Step 6: 変更をコミットする**

  Run: `git add src/components/SalesDashboard.tsx src/components/SalesDashboard.test.tsx src/components/OrderCard.tsx src/screens/AdminScreen.tsx src/screens/AdminScreen.test.tsx src/App.tsx src/styles.css && git commit -m "feat: add admin sales dashboard"`

### Task 5: 説明更新と全体検証

**Files:**
- Modify: `README.md`
- Modify: `docs/FIREBASE_SETUP.md`
- Modify: `src/deployment.test.tsx`

**Interfaces:**
- Consumes: Tasks 1〜4の完成した操作、権限、Firestore構造。
- Produces: 初めて使うスタッフ向けの短い利用手順と、公開設定・本番確認項目。

- [ ] **Step 1: 公開設定テストと説明を新仕様へ更新する**

  会計登録、注文管理、売上管理、PayPayは想定売上であること、取消、CSV、Firebaseルール再公開が必要なことを追記し、古い「注文だけ」の説明を置換する。

- [ ] **Step 2: 全テストを実行する**

  Run: `pnpm test`
  Expected: all tests PASS.

- [ ] **Step 3: 型検査と本番ビルドを実行する**

  Run: `pnpm typecheck && pnpm build`
  Expected: both commands exit 0 and Vite creates `dist/`.

- [ ] **Step 4: 差分と機密情報を確認する**

  Run: `git diff --check && git status --short && rg -n "AIza|BEGIN PRIVATE KEY|password" src docs firestore.rules README.md || true`
  Expected: no whitespace errors, no Firebase secret/private key/password added, only intended files changed.

- [ ] **Step 5: 最終変更をコミットする**

  Run: `git add README.md docs/FIREBASE_SETUP.md src/deployment.test.tsx docs/superpowers/plans/2026-10-11-pos-sales-implementation.md && git commit -m "docs: update POS operation guide"`

- [ ] **Step 6: 公開前レビューへ渡す**

  `superpowers:verification-before-completion`でテスト証跡を確認し、`superpowers:finishing-a-development-branch`でpushまたは統合方法を決める。
