# うさぽん パッケージメーカー

ハンドメイド作家向けに、箱の寸法から実寸の展開図を生成し、柄や文字を配置してA4 PDFへ出力するブラウザアプリです。

公開版: https://package.usa-pon.com/

## 起動

```bash
cd "/Users/yoshidafumio/Documents/ChatGPT/ボックス制作アプリ"
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://127.0.0.1:5174/` を開きます。

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
```

## 箱型

- `straight-tuck-carton-v1`
- `gift-box-v1`（4か所を接着するシンプルな浅型差し込み式）
- `n-style-gift-box-v1`（折り返しロックで組む、のり不要のN式浅型箱）
- `two-piece-gift-box-v1`（表示名：ツーピースギフトBOX。蓋と本体をA4 2枚で作る、四隅接着式）
- 幅 W／奥行または深さ D／高さ H／紙厚／のりしろをmmで指定
- カット線、折り線、のりしろ、柄、文字、ガイドを別レイヤーで生成
- カット線と折り線は淡いベージュを初期色とし、デザイン画面で個別に変更可能
- A4縦・横を判定し、`safe`／`paper-only`／`overflow` を表示
- サイズ画面でも判定した向きのA4用紙上に展開図を配置して表示
- `overflow` のときは自動縮小せずPDF出力を停止
- 蓋身箱は蓋／本体ごとにA4判定し、一方でも`overflow`なら2ページPDFの出力を停止

### 蓋身ギフトボックスの試作値

- 本体内寸 `W=100 / H=80 / D=40mm`
- 紙厚 `0.4mm`、蓋の片側余裕 `0.6mm`、蓋深さ `40mm`
- 本体展開範囲 `180 × 160mm`、蓋展開範囲 `182 × 162mm`（ともにA4横の安全領域内）
- 四隅のりしろ `12mm`。300gsm前後の厚紙へ100%で印刷し、筋入れ後に8〜10mm幅の強粘着両面テープで固定
- 初回は実紙で蓋の嵌合を確認し、きつい場合は片側余裕0.8mm、緩い場合は0.4mmへ調整

## デザイン編集

- 基本背景色の上へ、複数の背景画像・ストライプ・水玉をレイヤーとして重ねられます
- ストライプは色・線幅・間隔・向き、水玉は色・直径・間隔・X/Y位置を変更できます
- 背景・柄・文字色はカラーピッカーに加え、基本色、参考画像・おすすめ色、端末内へ保存するお気に入り色から選べます
- PNG／SVG画像は複数追加、表示切替、透明度、位置、大きさ、リピート、90度回転、複製、前後移動、削除に対応します
- スタンプは背景とは別レイヤーで管理し、同じく複数追加・ドラッグ移動・90度回転・並べ替えができます
- `Pofumofu friends` の透明PNGを初期スタンプとして収録しています。選択するまでは展開図へ追加されません
- 描画順は「基本背景 → 背景・柄 → スタンプ → テキスト → のりしろ・折り線・カット線・ガイド」です
- デザイン操作は、常に1項目だけ開く蛇腹UIにまとめています

## 実寸印刷

PDFはA4実寸で生成します。印刷画面では必ず次の設定にしてください。

1. 「100%」または「実際のサイズ」を選ぶ
2. 「用紙に合わせる」「ページにフィット」をOFFにする
3. PDFの50mm検寸ページを印刷し、定規で50mmになることを確認する

プリンターごとに印刷可能範囲や給紙誤差が異なるため、完成前に使用する紙で試作してください。

## データの扱い

未保存の作業と画像Blobは、OAuth遷移や再読み込みで失われないよう端末のIndexedDBへ自動退避します。Googleログイン後に「保存」を押した作品だけ、次のデータをSupabaseへ送信します。

- 箱寸法、背景色、柄・スタンプ・文字、線色、検寸ページ設定を含む`BoxDocumentV1` JSON
- ユーザーが追加したPNG／サニタイズ済みSVG（非公開Storage）

Googleから取得する情報は氏名、メールアドレス、プロフィール画像だけです。Google DriveやGmailへはアクセスせず、Google側のアクセストークンをアプリDBへ保存しません。PDFは従来どおりブラウザ内で生成します。詳細は[プライバシーポリシー](public/privacy.html)を確認してください。

### クラウド保存の制限

- 1アカウント20作品
- 画像は1点10MB、合計100MB
- 作品JSONは1MB
- PNG／SVGのみ

## Supabase設定

ブラウザへ渡す値はPublishable Keyだけです。`service_role`はEdge Functionsの実行環境以外へ置かないでください。

1. 東京リージョンの専用Supabaseプロジェクトを用意する
2. `supabase/migrations/202608120001_cloud_box_sync.sql`を適用する
3. `upload-box-asset`、`delete-box-project`、`delete-account`、`cleanup-box-assets`をデプロイする
4. Google Providerを有効にし、Site URLを`https://package.usa-pon.com/`へ設定する
5. Redirect URLsへ`https://package.usa-pon.com/`と`http://127.0.0.1:5174/`を追加する
6. GitHub Repository Variablesへ`VITE_SUPABASE_URL`と`VITE_SUPABASE_PUBLISHABLE_KEY`を登録する

ローカル開発では`.env.example`を`.env.local`へコピーし、同じ2値を設定します。秘密値を`VITE_`で始めないでください。

## クラウド保存の検証境界

モック／ローカルテストに加えて、公開完了前に実SupabaseでRLS、Storage、OAuth、保存競合、アカウント削除を確認します。Google OAuthのProduction公開とブランド確認が終わるまでは、テストユーザー以外のログインを完成扱いにしません。

## MVP対象外

- テンプレートから作る機能
- 3Dプレビュー
- AI生成
- 決済
