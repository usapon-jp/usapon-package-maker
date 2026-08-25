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
  return (
    <div className={`template-preview is-${template.category}`} data-template-id={template.id} aria-hidden="true">
      <div className="template-preview-paper">
        {template.category === "letter-paper" && <span className="template-preview-lines" />}
        {template.category === "envelope" && (
          <svg className="template-preview-envelope-fold" viewBox="0 0 179 119" preserveAspectRatio="none">
            <path d="M 1 1 L 89.5 64 L 178 1" />
            <path d="M 1 118 L 55 77 M 178 118 L 124 77" />
          </svg>
        )}
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
                    <div className="template-card-copy"><div className="template-card-meta"><span>{template.categoryLabel}</span>{template.badge && <b>{template.badge}</b>}</div><h3>{template.name}</h3><p>{template.description}</p><small>{template.seriesName}</small><strong>この型でつくる →</strong></div>
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
