import { useEffect, useState } from "react";

import { builtInStampForKey } from "../../app/artwork";
import { PACKAGE_TEMPLATES, type PackageTemplate } from "./template-catalog";

const FAVORITES_KEY = "usapon-package-maker.favorite-templates.v1";

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function TemplatePreview({ template }: { template: PackageTemplate }) {
  const stamp = builtInStampForKey(template.previewStampKey);
  if (template.category === "envelope") {
    return (
      <div className="template-preview is-envelope" data-template-id={template.id} aria-hidden="true">
        <div className="template-envelope-net">
          <span>展開図</span>
          <svg viewBox="0 0 276 200">
            <path d="M 138 0 L 219 40 L 276 97 L 219 154 L 138 200 L 57 154 L 0 97 L 57 40 Z" />
            <g><line x1="57" y1="40" x2="219" y2="40" /><line x1="57" y1="154" x2="219" y2="154" /><line x1="57" y1="40" x2="57" y2="154" /><line x1="219" y1="40" x2="219" y2="154" /></g>
          </svg>
        </div>
        <div className="template-envelope-arrow">→</div>
        <div className="template-envelope-finished">
          <span>完成</span>
          <div className="template-preview-paper">
            <svg className="template-preview-envelope-fold" viewBox="0 0 162 114" preserveAspectRatio="none"><path d="M 1 1 L 81 68 L 161 1" /><path d="M 1 113 L 52 76 M 161 113 L 110 76" /></svg>
            <img src={`${import.meta.env.BASE_URL}assets/stamps/${stamp.fileName}`} alt="" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`template-preview is-${template.category}`} data-template-id={template.id} aria-hidden="true">
      <div className="template-preview-paper">
        {template.category === "letter-paper" && <span className="template-preview-lines" />}
        <img src={`${import.meta.env.BASE_URL}assets/stamps/${stamp.fileName}`} alt="" />
      </div>
    </div>
  );
}

export function TemplateScreen({ onBack, onSelect }: { onBack: () => void; onSelect: (template: PackageTemplate) => void }) {
  const [favorites, setFavorites] = useState(readFavorites);

  useEffect(() => {
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* 端末内保存が無効でも一覧は使える。 */ }
  }, [favorites]);

  const series = [...new Map(PACKAGE_TEMPLATES.map((template) => [template.seriesId, { id: template.seriesId, name: template.seriesName }])).values()];

  return (
    <main className="tool-page template-page">
      <div className="page-heading">
        <button className="back-button" type="button" onClick={onBack}>← トップ</button>
        <p className="eyebrow">CHOOSE A TEMPLATE</p>
        <h1>つくるものを選ぶ</h1>
        <p>気になる型を選んで、背景・文字・スタンプを自由にデザインできます。</p>
      </div>

      {series.map((group) => (
        <section className="template-series" key={group.id} aria-labelledby={`template-series-${group.id}`}>
          <div className="template-series-heading"><div><p className="eyebrow">AUTUMN LETTER COLLECTION</p><h2 id={`template-series-${group.id}`}>{group.name}</h2></div><span>おそろいで作れる 3アイテム</span></div>
          <div className="template-card-grid">
            {PACKAGE_TEMPLATES.filter((template) => template.seriesId === group.id).map((template) => {
              const favorite = favorites.includes(template.id);
              return (
                <article className="template-card panel-card" key={template.id}>
                  <button className={`template-favorite ${favorite ? "is-favorite" : ""}`} type="button" aria-label={`${template.name}をお気に入り${favorite ? "から外す" : "に追加"}`} aria-pressed={favorite} onClick={() => setFavorites((items) => favorite ? items.filter((id) => id !== template.id) : [...items, template.id])}>{favorite ? "♥" : "♡"}</button>
                  <button className="template-select" type="button" onClick={() => onSelect(template)}>
                    <TemplatePreview template={template} />
                    <div className="template-card-copy"><div className="template-card-meta"><span>{template.categoryLabel}</span>{template.badge && <b>{template.badge}</b>}</div><h3>{template.name}</h3><p>{template.description}</p>{template.category === "envelope" && <div className="template-finished-size"><span>完成サイズ</span><strong>{template.box.widthMm} × {template.box.heightMm}mm</strong><small>洋形2号・A4横 1枚</small></div>}<small>{template.seriesName}</small><strong>この型でつくる →</strong></div>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
