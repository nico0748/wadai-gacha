# MEKURI（めくり）

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
| `DATABASE_URL` | 本番では必須 | PostgreSQLの接続URL（Supabase、Neonなど）。未設定ならPGliteを使います。テーブルは起動時に自動で作成・更新されます（`src/lib/db/migrations.ts`）。 |
| `ADMIN_PASSWORD` | 任意 | 設定すると `/admin` の管理画面が使えるようになります。未設定なら管理画面は無効です。 |
| `ADMIN_SESSION_SECRET` | 任意 | 管理画面のログインCookieの署名鍵。未設定なら初回にランダムな鍵を作ってデータベース（`app_secrets`）に保存し、パスワードと組み合わせて使います（パスワードを変えると全員ログアウト）。ログインは12時間で切れます。 |
| `PGLITE_DIR` | 任意 | PGliteの保存先（既定は `.data/pglite`）。 |
| `TRUSTED_PROXY_HOPS` | 任意 | アクセス元の判定に使うプロキシの段数（既定は1）。レート制限は `X-Forwarded-For` の右からこの数番目をアクセス元とみなします。Vercelや、nginx・ALB・Cloudflareを1段挟む構成は既定のままで大丈夫です。2段挟むときは2に。 |
| `SITE_URL` | 任意 | 公開URL（例：`https://mekutalk.example.com`）。SNSで共有したときの画像のURLに使います。Vercelでは未設定でも自動で入ります。 |

## デッキを編集する

- **最初から入っているデッキ**：`src/data/decks/*.json` を編集してデプロイします。ファイル名がURLのID（`/decks/game` など）になります。新しいファイルを追加したら `src/lib/decks/builtin.ts` に登録してください。`theme` は `candy` `mint` `lemon` `sky` `rose` `grape` から選べます。
- **管理画面のデッキ**：`/admin` から追加・編集・削除できます。デッキ一覧の最後に並びます。
- **ユーザーが作るデッキ**：`/decks/new` から誰でも作れます。共有用URLを知っている人だけが遊べて、編集用URLを持っている人だけが変更できます。デッキ一覧には載りません。

## ロゴとアイコン

名前は MEKURI（読みは めくり）。名前とキャッチコピーは `src/lib/brand.ts` にまとめてあり、ページのタイトル、共有、ホーム画面に追加したときの名前はここから読みます。

- ヘッダーのロゴは画像ではなく、Cormorant Garamond で組んだ文字です（`src/components/Logo.tsx`）
- 色と書体はアプリと同じです。墨 `#0f1218` の地、生成り `#ede6da` の文字、真鍮 `#c2a46e` の差し色、紙 `#f2ece2` のカード。見出しとカードの話題はしっぽり明朝 B1、本文は Zen角ゴシック New
- アイコンとファビコンは Nico が作った「重なり合う3枚のカード」です。元画像は [docs/brand](docs/brand) の `mekuri_app_icon_opaque.png`（タイル付き）と `mekuri_mark_transparent.png`（透過）で、`python3 scripts/export-icons.py`（要 Pillow）で各サイズに書き出します。AI生成の画像で背景にかすかなノイズがあるため、背景色を均してからマークを切り出しています。同じスクリプトが、カードだけを透過で切り抜いた `docs/brand/mekuri_mark.png` も書き出します
- 共有画像は、ロゴの文字組みとこの3枚のカードを並べたものです。`node scripts/render-brand.mjs` で描き直せます（PlaywrightのChromiumで描画。初回はGoogle Fontsの読み込みにネットワークが要ります。アイコンを差し替えたときは先に `export-icons.py` を）

| ファイル | 用途 |
| --- | --- |
| `src/app/apple-icon.png` | iPhoneのホーム画面アイコン（180px、角は端末が丸める） |
| `public/icons/icon-*.png` | Androidのホーム画面アイコン（`src/app/manifest.ts` から参照。maskable は端末の型抜きに収まるよう少し小さめ） |
| `src/app/favicon.ico`、`src/app/icon.png` | ブラウザのタブのアイコン（角丸のタイル。16・32・48pxは小さくても読めるようカードを大きめに） |
| `src/app/opengraph-image.png` | SNSで共有したときの画像（1200×630） |

前の名前「めくトーク」のときに作ったアイコンとタイトル画像は、経緯として [docs/brand](docs/brand) に残しています。

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

- 自分のサーバーで動かすときは、`next start` を直接公開せず、`X-Forwarded-For` にアクセス元を書き込むプロキシ（nginxなど）を前に置いてください。直接公開すると、アクセス元を偽ってレート制限をすり抜けられます。
- データベースの変更は起動時に自動で入ります（足すだけなので、古いサーバーが同じデータベースを使っていても壊れません）。ただし第1弾（MVP）のサーバーは「終了＝公開」とみなすため、第2弾で公開待ちのルームの一覧をルームコードだけで見せてしまいます。同じ `DATABASE_URL` を使う第1弾のデプロイ（Vercelの古いデプロイのURLを含む）は、切り替えたら止めるか、Deployment Protectionで保護してください。

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
