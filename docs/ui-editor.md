# うさぽん UI Editor

パッケージメーカーを最初の導入先とする、UI/CSSだけを調整する共通Editorです。通常画面に入口は表示しません。

## 開き方

管理URLは通常URLへ `?ui-edit=true` を付けます。Googleログイン後、Supabase Auth UIDが `package.ui_editor_admins` に登録されている利用者だけが開けます。GitHub Pagesは静的配信のためHTTPレスポンス自体を403にはできませんが、未許可利用者にはアプリ本体を描画せず、サーバー側RPCの判定後に403画面だけを表示します。

管理者登録はmigration適用後に運用者が一度だけ実行します。メールアドレスはコードや公開設定へ保存せず、この問い合わせで取得したUIDだけをallowlistへ保存します。

```sql
insert into package.ui_editor_admins (user_id)
select id from auth.users where lower(email) = lower('<ADMIN_EMAIL>')
on conflict (user_id) do nothing;
```

## 端末別設定

- 共通: 全幅の基本値
- スマホ: 600px以下。Editor内プレビューは390×844
- iPad: 601〜1023px。Editor内プレビューは768×1024
- PC: 1024px以上。Editor内プレビューは1440×900

各端末用の値は共通値の上へ重なり、ほかの端末用設定を書き換えません。

## 保存と公開

1. 編集値はブラウザ内の履歴へ追加され、Undo / Redoできます。
2. 「下書き保存」で管理者専用のDraftへ保存します。通常利用者の画面は変わりません。
3. 「本番へ反映」でDraftをPublishedへ移し、従来のPublishedをPreviousへ保持します。
4. 「前のUIへ戻す」でPublishedとPreviousを入れ替えます。

更新はrevisionによる楽観ロックを使い、別端末の更新を意図せず上書きしません。一般利用者は公開済み設定だけを読み取れ、Draft・Previous・管理者allowlist・編集RPCへアクセスできません。

## 共通モジュール

`packages/ui-editor` はアプリ固有処理を含みません。

- `@usapon/ui-editor/runtime`: 公開設定の検証、レスポンシブCSS生成、Provider、プレビュー連携
- `@usapon/ui-editor/editor`: iPad対応Editor、選択、数値・スライダー、Undo / Redo、リセット、保存・公開・ロールバック

別アプリではregistry、認証adapter、storage adapterを用意し、通常アプリを `UIEditorProvider` で包みます。編集可能値は型付きallowlistで検証され、任意CSS、absolute positioning、URL、HTML、アプリロジックは保存できません。

## ローカルQA

`npm run dev` 後に `/tests/ui-editor-harness.html` を開くと、DBへ書き込まないEditorの動作確認ができます。このHTMLはViteの本番entryではなく、production buildやGitHub Pagesへは出力されません。
