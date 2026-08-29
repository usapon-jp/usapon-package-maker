import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onOpenPwaGuide: () => void;
  isStandalone?: boolean;
  onClose: () => void;
}

export function SettingsSheetModal({ user, onLogin, onLogout, onDeleteAccount, onOpenPwaGuide, isStandalone = false, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="app-modal bottom-sheet-modal settings-sheet-modal" data-ui-id="global.settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-sheet-title">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-group">
            <img src={`${import.meta.env.BASE_URL}assets/usapon-brand-icon.png`} alt="うさぽん" className="sheet-brand-icon" />
            <div>
              <p className="eyebrow">SETTINGS</p>
              <h2 id="settings-sheet-title">設定・アカウント</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">アプリ化（PWA）</p>
          <div className="settings-option-list">
            {isStandalone ? <div className="settings-option-item is-installed" role="status">
              <span className="option-icon">✓</span>
              <div>
                <strong>ホーム画面版で起動中</strong>
                <small>すでにアプリとして追加されています</small>
              </div>
            </div> : <button type="button" className="settings-option-item" onClick={() => { onOpenPwaGuide(); onClose(); }}>
              <span className="option-icon">📱</span>
              <div>
                <strong>ホーム画面に追加（アプリ化）</strong>
                <small>iPhone/Androidのホーム画面へ追加して快適に使う手順</small>
              </div>
              <span>→</span>
            </button>}
          </div>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">アカウント管理</p>
          <div className="settings-option-list">
            {!user ? (
              <button type="button" className="settings-option-item google-login-item" onClick={() => { onLogin(); onClose(); }}>
                <span className="option-icon"><b>G</b></span>
                <div>
                  <strong>Googleでログイン</strong>
                  <small>ログインして作品をクラウドへ保存・複数端末同期</small>
                </div>
                <span>→</span>
              </button>
            ) : (
              <div className="user-account-card">
                <div className="user-account-info">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="user-avatar-placeholder">{(user.email ?? "U").slice(0, 1).toUpperCase()}</span>
                  )}
                  <div>
                    <strong>{user.user_metadata?.full_name ?? "ログイン中"}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <div className="account-action-buttons">
                  <button type="button" className="outline-button" onClick={() => { onLogout(); onClose(); }}>この端末からログアウト</button>
                  <button type="button" className="danger-button" onClick={() => { onDeleteAccount(); onClose(); }}>クラウドデータを削除</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">規約・ポリシー</p>
          <div className="settings-option-list">
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer" className="settings-option-item">
              <span className="option-icon">🔒</span>
              <div>
                <strong>プライバシーポリシー・利用規約</strong>
                <small>アカウント情報およびデータの取り扱いについて</small>
              </div>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
