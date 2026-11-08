# 話題ガチャ

トークの話題をカードのガチャで引けるスマホ向けWebアプリ。飲み会や雑談の場で、ホストのスマホをテーブルに置いて使います。

- **ルームモード**：ホストがルームを作るとQRコードが出て、参加者はスマホで読み込んで話題を投稿。集まったらホストのスマホでカードを1枚ずつ引き、終わると全員のスマホに全部の話題が公開されます。
- **ノーマルモード**：ゲーム・エンジニア・雑談などの用意されたデッキから引きます。自分でデッキを作って、URLで共有することもできます。

要件は [docs/requirements.md](docs/requirements.md) にまとめています。

## 動かす

Node.js 22 以上が必要です。

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。データベースの準備は不要で、ローカルでは [PGlite](https://pglite.dev/)（WASM版PostgreSQL）が `.data/pglite` に保存されます。

スマホから試すときは `npm run build && npm start` で起動し、PCと同じWi-Fiにつないだスマホで `http://<PCのIPアドレス>:3000` を開いてください（ホストのQRコードもそのアドレスを指します）。開発サーバー（`npm run dev`）はlocalhost以外からの読み込みをブロックするため、スマホからは本番モードで試すのが確実です。

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | 本番では必須 | PostgreSQLの接続URL（Supabase、Neonなど）。未設定ならPGliteを使います。テーブルは初回接続時に自動作成されます。 |
| `ADMIN_PASSWORD` | 任意 | 設定すると `/admin` の管理画面が使えるようになります。未設定なら管理画面は無効です。 |
| `ADMIN_SESSION_SECRET` | 任意 | 管理画面のログインCookieの署名鍵。未設定ならパスワードから導出します（パスワードを変えると全員ログアウト）。 |
| `PGLITE_DIR` | 任意 | PGliteの保存先（既定は `.data/pglite`）。 |

## デッキを編集する

- **最初から入っているデッキ**：`src/data/decks/*.json` を編集してデプロイします。ファイル名がURLのID（`/decks/game` など）になります。新しいファイルを追加したら `src/lib/decks/builtin.ts` に登録してください。`theme` は `candy` `mint` `lemon` `sky` `rose` `grape` から選べます。
- **管理画面のデッキ**：`/admin` から追加・編集・削除できます。デッキ一覧の最後に並びます。
- **ユーザーが作るデッキ**：`/decks/new` から誰でも作れます。共有用URLを知っている人だけが遊べて、編集用URLを持っている人だけが変更できます。デッキ一覧には載りません。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルドと起動 |
| `npm test` | ユニットテスト（Vitest、メモリ上のPGliteで実行） |
| `npm run test:e2e` | E2Eテスト（Playwright。先に `npm run build` が必要） |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## デプロイ

Vercelなどのサーバーレス環境では、ファイルシステムが永続化されないため必ず `DATABASE_URL` を設定してください。PGliteはローカル開発と1台構成のサーバー向けです。

## 構成

```
src/
  app/                 画面とAPI（Next.js App Router）
    api/rooms/...      ルームの作成・参加・投稿・ガチャ・終了
    api/decks/...      ユーザー作成デッキ
    api/admin/...      管理画面のログインと公式デッキ
  components/          UI（CardStage がカードを引く演出）
  data/decks/          最初から入っているデッキ（JSON）
  lib/
    db/                PGlite / PostgreSQL の切り替えとスキーマ
    rooms/             ルームのロジック（誰に何を見せるかもここで決める）
    decks/             デッキのロジック
    auth/              トークン、管理画面のセッション
tests/
  unit/                サービス層のテスト
  e2e/                 ブラウザでの通しテスト
```

## 技術スタック

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS v4、Motion、Zod、PGlite / PostgreSQL、Vitest、Playwright
