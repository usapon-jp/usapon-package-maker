export function AssemblyGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="app-modal assembly-guide-modal" role="dialog" aria-modal="true" aria-labelledby="assembly-guide-title">
        <div className="sample-guide-header">
          <div className="assembly-header-title">
            <img src={`${import.meta.env.BASE_URL}assets/usapon-brand-icon.png`} alt="うさぽん" className="assembly-usapon-icon" />
            <div>
              <p className="eyebrow">ASSEMBLY</p>
              <h2 id="assembly-guide-title">封筒の作り方ガイド</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <ol className="assembly-steps-list">
          <li><b>1. 切る</b><span>実線に沿って外周をはさみやカッターで綺麗に切ります。</span></li>
          <li><b>2. 折る</b><span>Bフタ、A表、C裏、左右のりしろを点線で谷折りします。</span></li>
          <li><b>3. 貼る</b><span>C裏の左右のりしろへ薄く糊を付け、A表を重ねて貼ります。</span></li>
          <li><b>4. 仕上げる</b><span>便箋・カードを入れ、最後にBフタを折って封をします。</span></li>
        </ol>
        <button className="primary-button full-button" type="button" onClick={onClose}>
          デザインへ戻る
        </button>
      </section>
    </div>
  );
}
