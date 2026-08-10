# うさぽん パッケージメーカー MVP

ハンドメイド作家向けに、箱の寸法から実寸の展開図を生成し、柄や文字を配置してA4 PDFへ出力するブラウザアプリです。

公開版: https://usapon-jp.github.io/usapon-package-maker/

## 起動

```bash
cd "/Users/yoshidafumio/Documents/ChatGPT/うさぽん制作ツール/package-maker"
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5174/` を開きます。

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
```

## MVPの箱型

- `straight-tuck-carton-v1`
- 幅 W／奥行 D／高さ H／紙厚／のりしろをmmで指定
- カット線、折り線、のりしろ、柄、文字、ガイドを別レイヤーで生成
- A4縦・横を判定し、`safe`／`paper-only`／`overflow` を表示
- `overflow` のときは自動縮小せずPDF出力を停止

## 実寸印刷

PDFはA4実寸で生成します。印刷画面では必ず次の設定にしてください。

1. 「100%」または「実際のサイズ」を選ぶ
2. 「用紙に合わせる」「ページにフィット」をOFFにする
3. PDFの50mm検寸ページを印刷し、定規で50mmになることを確認する

プリンターごとに印刷可能範囲や給紙誤差が異なるため、完成前に使用する紙で試作してください。

## データの扱い

画像、SVG、文字、PDFはすべてブラウザ内で処理します。ログイン、クラウド保存、外部送信はありません。

## MVP対象外

- テンプレートから作る機能
- 3Dプレビュー
- AI生成
- ログイン、クラウド保存
- 決済
- 複数の箱型
