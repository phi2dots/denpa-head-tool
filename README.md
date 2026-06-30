# Denpa Head Tool

`new 電波人間のRPG FREE` の頭の形の標準出生ルールを検索・確認するためのローカルWebアプリです。

## 起動方法

通常は同梱のバッチファイルを実行します。

```bat
start-server.bat
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:5173/
```

`index.html` を直接開く方法はサポート対象外です。JSON保存や画像読み込みの都合上、ローカルサーバー経由で確認してください。

## 現在できること

- 頭の形の検索
- タイプ、補正、耐性、特殊効果によるANDフィルタ
- 頭の形の詳細表示
- 標準出生ルールの一覧表示
- 出生ルートの進化元・進化先展開
- 出生ルートノードのドラッグ移動
- 出生ルート単位の一時非表示
- 頭の形データ、特徴データ、出生ルールの開発者向け編集
- データ整合性チェック（開発版のみ）
- JSONバックアップの作成と復元（開発版のみ）

## データファイル

- `data/head-shapes.json`
  - 頭の形、画像パス、タイプ、補正、耐性、特殊効果、備考を管理します。
- `data/evolution-rules.json`
  - 標準出生ルールを管理します。
- `assets/head-shapes/*.png`
  - 出生ルートや詳細で表示する頭の形画像です。

## 開発コマンド

Node.js環境がある場合は以下も利用できます。

```bat
pnpm install
pnpm dev
pnpm build
pnpm build:public
pnpm start
```

このリポジトリでは、ローカル編集用の確認は `pnpm build` 後に `start-server.bat` または `pnpm start` で行います。

公開用ビルドでは、開発者向けUIを非表示にします。

```bat
pnpm build:public
```

GitHub Pagesなどの静的ホスティングには、生成された `dist/` を公開します。静的ホスティングでは `server.js` は動作しないため、JSON保存APIや開発者向け編集UIは使いません。

## GitHub Pagesでの公開

このリポジトリには GitHub Pages 用の自動公開設定を含めています。

1. GitHubで空のリポジトリを作成します。
2. このプロジェクトを `main` ブランチへpushします。
3. GitHubのリポジトリ設定で、PagesのSourceを `GitHub Actions` にします。
4. `Deploy GitHub Pages` ワークフローが `pnpm build:public` を実行し、生成された `dist/` を公開します。

GitHub Pages上では利用者が `start-server.bat` を実行する必要はありません。公開URLへアクセスするだけで利用できます。

公開版では以下は非表示です。

- 頭の形JSON編集
- 特徴JSON編集
- 出生ルールJSON編集
- データ検証
- バックアップと復元

## 公開前チェック

開発版では、アプリ右上の開発者向けメニューからデータ検証を実行してください。公開版では開発者向けメニューは表示されません。

検証対象:

- 頭の形IDの重複
- gameNumberの重複
- 画像パス切れ
- 出生ルールIDの重複
- 存在しない頭の形IDへの参照
- 同一出生ルールの重複

## 未実装・今後検討

- ユーザDB
- 所持キャラ管理
- 個人の出生ルート記録管理
- 出生ルートの保存・共有
- PWA化
- オフライン利用
