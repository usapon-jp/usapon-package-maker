import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ThemePackDefinition } from "../../features/theme-packs/theme-pack-catalog";

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  themePacks?: readonly ThemePackDefinition[];
  unlockedThemePackIds?: string[];
  onRedeemThemePack?: (themePackId: string, passphrase: string) => Promise<void>;
  themeShopUrl?: string;
  onOpenPwaGuide: () => void;
  canEditUi?: boolean;
  onOpenUiEditor?: () => void;
  isStandalone?: boolean;
  onClose: () => void;
}

export function SettingsSheetModal({ user, onLogin, onLogout, onDeleteAccount, themePacks = [], unlockedThemePackIds = [], onRedeemThemePack, themeShopUrl, onOpenPwaGuide, canEditUi = false, onOpenUiEditor, isStandalone = false, onClose }: Props) {
  const [passphrases, setPassphrases] = useState<Record<string, string>>({});
  const [submittingPackId, setSubmittingPackId] = useState<string | null>(null);
  const [themeError, setThemeError] = useState("");
  const [addingPackId, setAddingPackId] = useState<string | null>(null);
  const [inputPackId, setInputPackId] = useState<string | null>(null);
  const redeem = async (themePackId: string) => {
    const passphrase = passphrases[themePackId]?.trim();
    if (!passphrase) return;
    setSubmittingPackId(themePackId);
    setThemeError("");
    try {
      if (!onRedeemThemePack) return;
      await onRedeemThemePack(themePackId, passphrase);
      setPassphrases((current) => ({ ...current, [themePackId]: "" }));
    } catch (reason) {
      setThemeError(reason instanceof Error ? reason.message : "合言葉を確認できませんでした。");
    } finally {
      setSubmittingPackId(null);
    }
  };
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

        {canEditUi && onOpenUiEditor && (
          <div className="settings-section">
            <p className="settings-section-title">管理者用</p>
            <div className="settings-option-list">
              <button type="button" className="settings-option-item" onClick={onOpenUiEditor}>
                <span className="option-icon">✏️</span>
                <div>
                  <strong>UI編集モードを開く</strong>
                  <small>画面の見た目を調整し、下書き保存・本番反映できます</small>
                </div>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

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
          <div className="settings-option-list theme-pack-account-list">
            <p className="settings-subsection-title">テーマパックを追加</p>
            {themePacks.map((pack) => {
              const unlocked = unlockedThemePackIds.includes(pack.id);
              return <div className="theme-pack-account-item" key={pack.id}>
                <div><strong>{pack.name}</strong><small>{unlocked ? "✓ 追加済み" : pack.description}</small></div>
                {!unlocked && addingPackId !== pack.id && <button type="button" className="outline-button theme-pack-add-button" onClick={() => { setAddingPackId(pack.id); setInputPackId(null); setThemeError(""); }}>テーマパックを追加</button>}
                {!unlocked && addingPackId === pack.id && <div className="theme-pack-add-flow">
                  {!user ? <button type="button" className="outline-button" onClick={onLogin}>Googleでログインして合言葉を入力</button> : inputPackId !== pack.id ? <button type="button" className="outline-button" onClick={() => setInputPackId(pack.id)}>合言葉を入力して追加</button> : <div className="theme-pack-password-row">
                  <input
                    aria-label={`${pack.name}の合言葉`}
                    type="password"
                    autoComplete="off"
                    placeholder="合言葉を入力"
                    value={passphrases[pack.id] ?? ""}
                    onChange={(event) => setPassphrases((current) => ({ ...current, [pack.id]: event.target.value }))}
                    onKeyDown={(event) => { if (event.key === "Enter") void redeem(pack.id); }}
                  />
                  <button type="button" className="outline-button" disabled={submittingPackId === pack.id || !(passphrases[pack.id]?.trim())} onClick={() => { void redeem(pack.id); }}>{submittingPackId === pack.id ? "確認中…" : "追加"}</button>
                </div>}
                  {themeShopUrl && <a href={themeShopUrl} target="_blank" rel="noreferrer" className="outline-button theme-pack-shop-link">ショップで見る</a>}
                </div>}
              </div>;
            })}
            {themeError && <p className="field-error" role="alert">{themeError}</p>}
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
