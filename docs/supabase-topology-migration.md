# パッケージメーカー Supabase統合手順

## 境界

- 共有本番 `usapon-main`：`vuxedteujpncjutiympt`
- 旧パッケージメーカー本番：`gfuzmxkhhouhdrpjwajn`
- DB：`package`スキーマ
- Storage：`package-box-assets`、`package-theme-pack-assets`
- Edge Functions：`package-`接頭辞
- Auth：共有本番のGoogle Providerを使用

旧本番は切替検証が完了するまで変更・停止・削除しない。共有本番の`public`、`morning`、`reel`スキーマ、既存Storage、Auth設定、Redirect URLsは上書きしない。

## 安全な切替順序

1. 共有本番のmigration履歴を取得し、package migrationだけが新規適用対象になることをdry-runで確認する。
2. `package`スキーマと固有Storage bucketを作成し、Data APIへ`package`を追加する。
3. `package-`接頭辞のEdge Functionsをデプロイする。
4. 旧本番のAuth・作品・素材・権利データを、利用者対応表を検証してからコピーする。
5. Storageオブジェクトの件数・容量・チェックサムと、DB行数・所有者・参照関係を旧本番と照合する。
6. Redirect URLsへパッケージメーカーURLを追加し、共有本番のGoogleログインを通常UIから確認する。
7. GitHub Pagesの2つの公開変数を共有本番へ切り替え、保存・再読込・複製・削除・テーマ解放をE2E確認する。
8. 旧本番をロールバック用に保持し、利用者データの確認後にのみ`usapon-lab`転用へ進む。

## データ移行時の注意

2026-08-27の読み取り棚卸しでは、旧本番にAuth 3人、作品4件、素材2件があり、共有本番とメールが一致する利用者は1人だった。残る2人は共有本番側でGoogleログインできる利用者IDを確定してから所有者を対応付ける。

作品JSON、Auth情報、Storageメタデータを一時ファイルへ書き出す場合は、対象テーブルを限定し、権限600の一時領域に保存する。検証完了後に削除する。メールアドレス、秘密鍵、作品本文をログ・Git・チャットへ出力しない。

## `usapon-lab`転用条件

次をすべて満たすまで、旧本番の名称変更・データ削除・キー更新・停止を行わない。

- 共有本番で全利用者の所有者対応が完了
- DB、Storage、テーマ権利の照合が一致
- 公開UIでログイン、保存、再読込、素材表示、削除が成功
- ロールバック用バックアップの復元方法を確認
- 利用者が最終確認

条件を満たした後も、実際の削除・名称変更・キー更新は対象を提示し、実行直前に明示承認を得る。
