import { useEffect, useRef, useState } from "react";
import "./material-notice.css";
export function selectNewMaterial(userId: string | undefined, status: string, packs: string[], seen: (pack: string) => boolean) {
  return userId && (status === "ready" || status === "trial-ready") ? packs.find(pack => !seen(pack)) : undefined;
}
export function noticeMode(newPack: string | undefined, entry: boolean, status: string) {
  return newPack ? "ready" : entry && status === "signed-out" ? "login" : entry && (status === "none" || status === "error") ? "missing" : "";
}
const ENTRY = "usapon.material-entry";
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string) => { try { localStorage.setItem(key, "1"); } catch { /* In-memory dismissal still works. */ } };
export function MaterialNotice({ app, userId, status, packs, onLogin, onView }: {
  app: string; userId?: string; status: string; packs: string[];
  onLogin: () => void | Promise<void>; onView: (pack: string) => void;
}) {
  const [entry, setEntry] = useState(() => {
    const incoming = new URLSearchParams(location.search).get("materials") === "received";
    try { if (incoming) sessionStorage.setItem(ENTRY, "1"); return incoming || sessionStorage.getItem(ENTRY) === "1"; } catch { return incoming; }
  });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const newPack = selectNewMaterial(userId, status, packs, pack => Boolean(read(`usapon.notice:${app}:${userId}:${pack}`)) || dismissed.includes(`${userId}:${pack}`));
  const mode = noticeMode(newPack, entry, status);
  useEffect(() => { if (mode && !dialog.current?.open) dialog.current?.showModal(); else if (!mode) dialog.current?.close(); }, [mode]);
  useEffect(() => {
    if (entry && userId && (status === "ready" || status === "trial-ready") && !newPack) { setEntry(false); try { sessionStorage.removeItem(ENTRY); } catch {} }
  }, [entry, userId, status, newPack]);
  function finish() {
    if (newPack && userId) { packs.forEach(pack => write(`usapon.notice:${app}:${userId}:${pack}`)); setDismissed(items => [...items, ...packs.map(pack => `${userId}:${pack}`)]); }
    setEntry(false);
    try { sessionStorage.removeItem(ENTRY); } catch { /* optional persistence */ }
    const url = new URL(location.href); url.searchParams.delete("materials"); history.replaceState(history.state, "", url);
  }
  return <dialog ref={dialog} className="material-notice" aria-labelledby="material-notice-title" onCancel={finish}>
    <h2 id="material-notice-title">{mode === "ready" ? "新しい素材が使えるようになりました" : mode === "login" ? "素材を使う準備をしましょう" : "購入・受取済みの素材を確認しましょう"}</h2>
    <p>{mode === "ready" ? "購入・受取済みの素材を、このアプリでも楽しめます。" : mode === "login" ? "購入・受取時と同じGoogleアカウントでログインしてください。" : "素材を確認できませんでした。購入・受取時と同じアカウントかご確認ください。買い直しは不要です。"}</p>
    {error && <p role="alert">{error}</p>}
    <div className="material-notice-actions">
      {mode === "ready" && <button type="button" onClick={() => { const pack = newPack!; finish(); onView(pack); }}>素材を見る</button>}
      {mode === "login" && <button type="button" onClick={() => { setError(""); Promise.resolve().then(onLogin).catch(() => setError("ログインを開始できませんでした。もう一度お試しください。")); }}>Googleでログイン</button>}
      {mode === "missing" && <a href="https://usapon-digital-shop.vercel.app/purchased">購入済みの方はこちら</a>}
      <button type="button" onClick={finish}>あとで</button>
    </div>
  </dialog>;
}
