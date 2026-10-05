# ちょなちょナゲット注文管理アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 店頭iPadで最大5組の注文を受け、パソコンの管理画面でリアルタイム管理できるGitHub Pages対応アプリを作る。

**Architecture:** React/TypeScriptの静的PWAをGitHub Pagesへ配置し、Firebase AuthenticationとCloud Firestoreで認証・リアルタイム同期を行う。注文作成はFirestoreトランザクションで空いている受付番号1〜5を確保し、完了または取消時に番号を再利用可能にする。

**Tech Stack:** React 19, TypeScript, Vite, Firebase Web SDK, Vitest, Testing Library, GitHub Actions

**Spec:** この会話で承認済みの要件（ユーザー指示により別設計書は作成しない）

## Global Constraints

- 注文は店舗が用意する1台のiPadからのみ受け付ける。
- 受付番号は空いている1〜5の最小番号を使い、5組受付中は新規注文を拒否する。
- 1カップは4個入り・300円。複数の味と複数カップを1注文に含められる。
- 共通味は塩レモン、チリチーズ、サワークリーム。11日限定はのり塩、ストロングガーリック。12日限定は明太子バター、コンソメ。
- 注文端末と管理者は別アカウントで初回ログインし、Firebase Security Rulesで権限を分離する。
- 注文者の個人情報は保存しない。
- GitHub PagesのプロジェクトURL `/Chonabayashi_seminar/` で動作する。

## Review Focus

- 注文ボタンの連打でも注文が1件だけ作られること。
- 同時注文時も受付番号が重複せず、6件目が拒否されること。
- 0カップ、負数、不正な味、上限を超える数量が拒否されること。
- 通信失敗時に受付済みと誤表示しないこと。
- 注文端末が管理操作できず、未認証利用者が注文できないこと。

---

### Task 1: 注文ドメインとプロジェクト基盤

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/domain/menu.ts`, `src/domain/order.ts`
- Test: `src/domain/order.test.ts`

**Interfaces:**
- Produces: `MenuDay`, `Flavor`, `OrderItem`, `OrderDraft`, `calculateTotals(items)`, `validateOrder(items, day)`

- [ ] テスト環境を構成し、価格・個数・日別メニュー・不正入力の失敗テストを書く。
- [ ] テストを実行し、未実装による期待どおりの失敗を確認する。
- [ ] 注文ドメインを最小実装し、テストを通す。
- [ ] 全テストを実行し、コミットする。

### Task 2: Firebase認証・注文ストア・権限ルール

**Files:**
- Create: `src/firebase/client.ts`, `src/firebase/auth.ts`, `src/firebase/orderStore.ts`, `src/firebase/types.ts`, `firestore.rules`, `firebase.json`, `.env.example`
- Test: `src/firebase/orderStore.test.ts`, `src/firebase/rules-model.test.ts`

**Interfaces:**
- Consumes: Task 1の`OrderItem`と計算・検証関数
- Produces: `signIn`, `signOut`, `observeSession`, `createOrder`, `observeSlots`, `transitionOrder`, `setActiveMenuDay`, `ensureStoreInitialized`

- [ ] 空き番号選択、満員拒否、状態遷移、通信失敗のテストを先に書く。
- [ ] テストを実行し、未実装による期待どおりの失敗を確認する。
- [ ] Firebaseアダプターと、テスト可能な純粋ロジックを最小実装する。
- [ ] 注文端末・管理者の権限を分離するFirestore Rulesを書く。
- [ ] 全テスト・型検査を実行し、コミットする。

### Task 3: iPad注文画面とパソコン管理画面

**Files:**
- Create: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/KioskScreen.tsx`, `src/screens/AdminScreen.tsx`, `src/components/FlavorCard.tsx`, `src/components/OrderSummary.tsx`, `src/components/OrderCard.tsx`, `src/styles.css`
- Test: `src/screens/KioskScreen.test.tsx`, `src/screens/AdminScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1のドメイン、Task 2の認証・注文ストア
- Produces: `#/`注文端末、`#/admin`管理画面

- [ ] 注文入力、受付番号表示、5組満員、状態変更、完了解放の画面テストを書く。
- [ ] テストを実行し、画面未実装による期待どおりの失敗を確認する。
- [ ] 大きなタッチ操作と日本語表示を備えた各画面を最小実装する。
- [ ] 全テスト・型検査を実行し、コミットする。

### Task 4: PWA・GitHub Pages公開設定・利用手順

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon.svg`, `public/sw.js`, `.github/workflows/deploy-pages.yml`, `README.md`, `docs/FIREBASE_SETUP.md`
- Modify: `index.html`, `src/main.tsx`
- Test: `src/deployment.test.ts`

**Interfaces:**
- Consumes: Task 3の完成アプリ
- Produces: GitHub Pages用ビルドとFirebase初期設定手順

- [ ] Pagesのサブパス、PWA登録、Firebase設定不足時の案内を検証するテストを書く。
- [ ] テストを実行し、未設定による期待どおりの失敗を確認する。
- [ ] PWAとPagesワークフロー、日本語セットアップ手順を実装する。
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build`を実行し、コミットする。
