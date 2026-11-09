# めくトーク

トークの話題をカードで1枚ずつめくるスマホ向けWebアプリ。飲み会や雑談の場で、ホストのスマホをテーブルに置いて使います。

- **ルームモード**：ホストがルームを作るとQRコードが出て、参加者はスマホで読み込んで話題を投稿。集まったらホストのスマホでカードを1枚ずつめくります。終わるとホストの「せーの」で全員のスマホに全部の話題が公開され、名前を出す設定なら1件ずつ投稿者の答え合わせができます。
- **ノーマルモード**：ゲーム・エンジニア・雑談・初対面・もしも・恋バナの用意されたデッキからめくります。自分でデッキを作って、URLで共有することもできます。

要件は [docs/requirements.md](docs/requirements.md)（MVP）と [docs/requirements-v2.md](docs/requirements-v2.md)（第2弾）にまとめています。

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
| `ADMIN_SESSION_SECRET` | 任意 | 管理画面のログインCookieの署名鍵。未設定なら初回にランダムな鍵を作ってデータベース（`app_secrets`）に保存し、パスワードと組み合わせて使います（パスワードを変えると全員ログアウト）。ログインは12時間で切れます。 |
| `PGLITE_DIR` | 任意 | PGliteの保存先（既定は `.data/pglite`）。 |
| `SITE_URL` | 任意 | 公開URL（例：`https://mekutalk.example.com`）。SNSで共有したときの画像のURLに使います。Vercelでは未設定でも自動で入ります。 |

## デッキを編集する

- **最初から入っているデッキ**：`src/data/decks/*.json` を編集してデプロイします。ファイル名がURLのID（`/decks/game` など）になります。新しいファイルを追加したら `src/lib/decks/builtin.ts` に登録してください。`theme` は `candy` `mint` `lemon` `sky` `rose` `grape` から選べます。
- **管理画面のデッキ**：`/admin` から追加・編集・削除できます。デッキ一覧の最後に並びます。
- **ユーザーが作るデッキ**：`/decks/new` から誰でも作れます。共有用URLを知っている人だけが遊べて、編集用URLを持っている人だけが変更できます。デッキ一覧には載りません。

## ロゴとアイコン

元の画像は [docs/brand](docs/brand) にあります。アプリで使っているのは、そこから書き出した次のファイルです。

| ファイル | 用途 |
| --- | --- |
| `src/assets/mekutalk-title.png` | ヘッダーのタイトル（元画像を幅1200pxに縮小） |
| `src/app/apple-icon.png` | iPhoneのホーム画面アイコン（180px） |
| `public/icons/icon-*.png` | Androidのホーム画面アイコン（`src/app/manifest.ts` から参照） |
| `src/app/favicon.ico`、`src/app/icon.png` | ブラウザのタブのアイコン（ファビコン用の画像から周りの透過ノイズを除いて書き出し。16・32・48pxと256px） |
| `src/app/opengraph-image.png` | SNSで共有したときの画像（1200×630） |

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
    api/rooms/...      ルームの作成・参加・投稿・めくる・終了・公開・答え合わせ
    api/decks/...      ユーザー作成デッキ
    api/admin/...      管理画面のログインと公式デッキ
  components/          UI（CardStage がカードを引く演出）
  data/decks/          最初から入っているデッキ（JSON）
  lib/
    db/                PGlite / PostgreSQL の切り替えとデータ移行（migrations.ts）
    rooms/             ルームのロジック（誰に何を見せるかもここで決める）
    decks/             デッキのロジック
    auth/              トークン、管理画面のセッション
tests/
  unit/                サービス層のテスト
  e2e/                 ブラウザでの通しテスト
```

## 技術スタック

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS v4、Motion、Zod、PGlite / PostgreSQL、Vitest、Playwright
