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
  const stampUrl = stamp.themePackId ? `${import.meta.env.BASE_URL}assets/theme-previews/${stamp.fileName}` : `${import.meta.env.BASE_URL}assets/stamps/${stamp.fileName}`;
  if (template.category === "envelope") {
    return (
      <div className="template-preview is-envelope" data-template-id={template.id} aria-hidden="true">
        <div className="template-envelope-net">
          <span>展開図</span>
          <svg viewBox="0 0 186 258">
            <path d="M 18 0 L 168 0 L 174 30 L 174 144 L 186 150 L 186 252 L 174 258 L 12 258 L 0 252 L 0 150 L 12 144 L 12 30 Z" />
            <g><line x1="12" y1="30" x2="174" y2="30" /><line x1="12" y1="144" x2="174" y2="144" /><line x1="12" y1="144" x2="12" y2="258" /><line x1="174" y1="144" x2="174" y2="258" /></g>
            <g className="template-envelope-face-labels"><text x="93" y="18">B</text><text x="93" y="90">A</text><text x="93" y="205">C</text></g>
          </svg>
        </div>
        <div className="template-envelope-arrow">→</div>
        <div className="template-envelope-finished">
          <span>完成</span>
          <div className="template-preview-paper">
            <svg className="template-preview-envelope-fold" viewBox="0 0 162 114" preserveAspectRatio="none"><rect x="1" y="1" width="160" height="112" rx="2" /><path d="M 1 1 L 81 36 L 161 1" /></svg>
            <img src={stampUrl} alt="" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`template-preview is-${template.category}`} data-template-id={template.id} aria-hidden="true">
      <div className="template-preview-paper">
        {template.category === "letter-paper" && <span className="template-preview-lines" />}
        <img src={stampUrl} alt="" />
      </div>
    </div>
  );
}

export function TemplateScreen({ onBack, onSelect, unlockedThemePackIds }: { onBack: () => void; onSelect: (template: PackageTemplate) => void; unlockedThemePackIds: string[] }) {
  const [favorites, setFavorites] = useState(readFavorites);

  useEffect(() => {
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* 端末内保存が無効でも一覧は使える。 */ }
  }, [favorites]);

  const series = [...new Map(PACKAGE_TEMPLATES.map((template) => [template.seriesId, { id: template.seriesId, name: template.seriesName }])).values()];

  return (
    <main className="tool-page template-page" data-ui-id="templates.screen">
      <div className="page-heading">
        <button className="back-button" type="button" onClick={onBack}>← トップ</button>
        <p className="eyebrow">CHOOSE A TEMPLATE</p>
        <h1>つくるものを選ぶ</h1>
        <p>気になる型を選んで、背景・文字・スタンプを自由にデザインできます。</p>
      </div>

      {series.map((group) => (
        <section className="template-series" key={group.id} aria-labelledby={`template-series-${group.id}`}>
          <div className="template-series-heading"><div><p className="eyebrow">{group.id === "autumn-letter-set" ? "AUTUMN LETTER COLLECTION" : "LETTER SET BASICS"}</p><h2 id={`template-series-${group.id}`}>{group.name}</h2></div><span>{PACKAGE_TEMPLATES.filter((template) => template.seriesId === group.id).length}アイテム</span></div>
          <div className="template-card-grid" data-ui-id={`templates.grid.${group.id}`}>
            {PACKAGE_TEMPLATES.filter((template) => template.seriesId === group.id).map((template) => {
              const favorite = favorites.includes(template.id);
              const locked = Boolean(template.themePackId && !unlockedThemePackIds.includes(template.themePackId));
              return (
                <article className={`template-card panel-card ${locked ? "is-locked" : ""}`} key={template.id}>
                  <button className={`template-favorite ${favorite ? "is-favorite" : ""}`} type="button" aria-label={`${template.name}をお気に入り${favorite ? "から外す" : "に追加"}`} aria-pressed={favorite} onClick={() => setFavorites((items) => favorite ? items.filter((id) => id !== template.id) : [...items, template.id])}>{favorite ? "♥" : "♡"}</button>
                  <button className="template-select" type="button" onClick={() => onSelect(template)}>
                    <TemplatePreview template={template} />
                    <div className="template-card-copy"><div className="template-card-meta"><span>{template.categoryLabel}</span>{template.badge && <b>{template.badge}</b>}</div><h3>{template.name}</h3><p>{template.description}</p>{template.category === "envelope" && <div className="template-finished-size"><span>完成サイズ</span><strong>{template.box.widthMm} × {template.box.heightMm}mm</strong><small>展開 186 × 258mm・A4縦</small></div>}<small>{template.seriesName}</small><strong>{locked ? "🔒 合言葉で解除" : "この型でつくる →"}</strong></div>
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
