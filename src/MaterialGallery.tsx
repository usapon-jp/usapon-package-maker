import { useEffect, useRef, useState } from "react";
import { BUILT_IN_STAMPS } from "./app/artwork";
import { downloadThemeAsset } from "./cloud/box-repository";
import { isAutumnTrialStamp } from "./features/theme-packs/free-trial";
export function MaterialGallery({ pack, onClose }: { pack: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const stamps = BUILT_IN_STAMPS.filter(p => !('legacy' in p && p.legacy) && (pack === 'autumn-letter-set' ? p.key.startsWith('autumn-stamp-') : isAutumnTrialStamp(p.key)));
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    const blobs: string[] = [];
    setUrls({}); setFailed(false);
    Promise.all(stamps.map(async p => {
      if (p.delivery !== 'private') return [p.key, `${import.meta.env.BASE_URL}assets/stamps/${p.fileName}`];
      const url = URL.createObjectURL(await downloadThemeAsset(p.themePackId!, p.fileName));
      if (!active) { URL.revokeObjectURL(url); return [p.key, '']; }
      blobs.push(url); return [p.key, url];
    })).then(rows => { if (active) setUrls(Object.fromEntries(rows)); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; blobs.forEach(url => URL.revokeObjectURL(url)); };
  }, [pack, retry]);
  return <dialog ref={dialog} className="material-notice" aria-labelledby="material-gallery-title" onCancel={onClose}>
    <h2 id="material-gallery-title">{pack === 'autumn-letter-set' ? '秋のスタンプ' : '秋のお試し素材'}</h2>
    <p>作品の編集画面で「スタンプ」を開くと、この素材を追加できます。</p>
    {failed ? <p role="alert">素材を読み込めませんでした。<button onClick={() => setRetry(n => n + 1)}>再読み込み</button></p> : Object.keys(urls).length ? <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>{stamps.map(p => <img key={p.key} src={urls[p.key]} alt={p.name} style={{width:'100%',height:90,objectFit:'contain'}} />)}</div> : <p role="status">素材を読み込んでいます…</p>}
    <div className="material-notice-actions"><button onClick={onClose}>閉じる</button></div>
  </dialog>;
}
