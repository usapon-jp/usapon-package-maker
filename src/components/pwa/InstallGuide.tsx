import { useEffect, useState } from "react";

import type { InstallContext } from "../../lib/pwa/install-guide";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  open: boolean;
  context: InstallContext;
  hasBrowserOnlyWork: boolean;
  cloudSaved: boolean;
  onClose: () => void;
  onNeverShow: () => void;
};

export function InstallGuide({ open, context, hasBrowserOnlyWork, cloudSaved, onClose, onNeverShow }: Props) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      onClose();
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, [onClose]);

  if (!open || context.isStandalone) return null;

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") onClose();
    setInstallPrompt(null);
  };

  return (
    <div className="modal-backdrop install-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="app-modal install-guide" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
        <p className="eyebrow">ADD TO HOME SCREEN</p>
        <h2 id="install-guide-title">ホーム画面から、すぐ作れます</h2>
        <p>うさぽん パッケージメーカーをホーム画面へ追加すると、次回からアイコンで開けます。</p>

        {hasBrowserOnlyWork && !cloudSaved && (
          <div className="install-data-warning" role="status">
            <strong>今の作品は、まだこのブラウザだけにあります</strong>
            <p>InstagramからSafari・Chromeへ移る前に、この案内を閉じて画面上部の「保存」を押してください。クラウド保存後なら、移動先で同じGoogleアカウントにログインして開けます。</p>
          </div>
        )}
        {cloudSaved && (
          <div className="install-data-safe" role="status">
            <strong>この作品はクラウド保存済みです</strong>
            <p>別のブラウザやホーム画面版では、同じGoogleアカウントでログインすると「マイボックス」から続けられます。</p>
          </div>
        )}

        {context.isInstagramInAppBrowser ? (
          <ol className="install-steps">
            <li><span>1</span><div><strong>Instagram右上の「…」をタップ</strong><small>メニューの名称はInstagramのバージョンで少し異なります。</small></div></li>
            <li><span>2</span><div><strong>「外部ブラウザーで開く」を選ぶ</strong><small>{context.platform === "ios" ? "iPhoneではSafariで開いてください。" : "AndroidではChromeなど通常のブラウザで開いてください。"}</small></div></li>
            <li><span>3</span><div><strong>通常ブラウザでもう一度この案内を開く</strong><small>ページ下部の「ホーム画面に追加する」から再表示できます。</small></div></li>
          </ol>
        ) : context.platform === "ios" ? (
          <ol className="install-steps">
            <li><span>1</span><div><strong>Safariの共有ボタンをタップ</strong><small>四角から上向き矢印が出ているボタンです。</small></div></li>
            <li><span>2</span><div><strong>「ホーム画面に追加」を選ぶ</strong><small>見つからない場合は、共有メニューを下へスクロールします。</small></div></li>
            <li><span>3</span><div><strong>右上の「追加」をタップ</strong><small>うさぽんのアイコンがホーム画面に追加されます。</small></div></li>
          </ol>
        ) : installPrompt ? (
          <div className="install-direct">
            <p>このブラウザから直接インストールできます。</p>
            <button className="primary-button" type="button" onClick={() => { void install(); }}>ホーム画面に追加する</button>
          </div>
        ) : (
          <ol className="install-steps">
            <li><span>1</span><div><strong>ブラウザのメニューを開く</strong><small>Android Chromeでは右上の「︙」です。</small></div></li>
            <li><span>2</span><div><strong>「アプリをインストール」または「ホーム画面に追加」</strong><small>表示された確認画面で追加してください。</small></div></li>
          </ol>
        )}

        <div className="install-guide-actions">
          <button type="button" onClick={onClose}>あとで</button>
          <button type="button" onClick={onNeverShow}>今後は自動表示しない</button>
        </div>
      </section>
    </div>
  );
}

