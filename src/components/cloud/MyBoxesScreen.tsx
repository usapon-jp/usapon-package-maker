import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import {
  deleteCloudProject,
  duplicateCloudProject,
  listCloudProjects,
  ProjectConflictError,
  renameCloudProject,
} from "../../cloud/box-repository";
import type { CloudProjectSummary, ProjectWorkspace } from "../../cloud/types";
import type { BoxType } from "../../domain/boxes/types";

const BOX_NAMES: Record<BoxType, string> = {
  "straight-tuck-carton-v1": "キャラメル箱",
  "gift-box-v1": "浅型差し込みギフト箱",
  "two-piece-gift-box-v1": "ツーピースギフトBOX",
  "letter-paper-v1": "便箋",
  "envelope-v1": "封筒",
  "mini-card-v1": "ミニカード",
};

function errorMessage(error: unknown) {
  if (error instanceof ProjectConflictError) return "別の端末で更新されています。画面を再読み込みしました。";
  if (error instanceof Error) {
    if (error.message.includes("PROJECT_LIMIT_REACHED")) return "保存できる作品は20件までです。不要な作品を削除してください。";
    return error.message;
  }
  return "操作を完了できませんでした。";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type Props = {
  user: User | null;
  onLogin: () => void;
  onBack: () => void;
  onNew: () => void;
  onOpen: (project: ProjectWorkspace) => Promise<void>;
  onWorkspaceChange: (workspace: ProjectWorkspace) => void;
};

export function MyBoxesScreen({ user, onLogin, onBack, onNew, onOpen, onWorkspaceChange }: Props) {
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      setProjects(await listCloudProjects());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const rename = async (project: CloudProjectSummary) => {
    const name = window.prompt("新しい作品名を入力してください（80文字以内）", project.name)?.trim();
    if (!name || name === project.name) return;
    setBusyId(project.id);
    setError("");
    try {
      const updated = await renameCloudProject(project, name);
      onWorkspaceChange(updated);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (project: CloudProjectSummary) => {
    setBusyId(project.id);
    setError("");
    try {
      await duplicateCloudProject(project);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (project: CloudProjectSummary) => {
    if (!window.confirm(`「${project.name}」を削除しますか？\nこの操作は取り消せません。`)) return;
    setBusyId(project.id);
    setError("");
    try {
      await deleteCloudProject(project.id);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="tool-page my-boxes-page">
      <div className="page-heading horizontal-heading my-boxes-heading">
        <div>
          <button className="back-button" type="button" onClick={onBack}>← 戻る</button>
          <p className="eyebrow">MY DESIGNS</p>
          <h1>マイデザイン</h1>
          <p>Googleアカウントに保存した作品（BOX・レターセット）をどの端末からでも開けます。</p>
        </div>
        {user && <button className="primary-button my-boxes-new" type="button" onClick={onNew}>＋ 新しい作品</button>}
      </div>

      {!user ? (
        <section className="panel-card cloud-signin-card">
          <span aria-hidden="true">☁</span>
          <h2>Googleログインが必要です</h2>
          <p>ログインすると、保存した作品をMac・スマホ・iPadで共有できます。</p>
          <button className="google-login-button" type="button" onClick={onLogin}><b>G</b> Googleでログイン</button>
        </section>
      ) : (
        <>
          <div className="cloud-quota-note"><span>作品 {projects.length} / 20</span><span>画像は1点10MB、合計100MBまで</span></div>
          {error && <p className="cloud-page-error" role="alert">{error}</p>}
          {loading ? (
            <div className="cloud-loading" role="status">作品を読み込んでいます…</div>
          ) : projects.length === 0 ? (
            <section className="panel-card cloud-empty-card">
              <span aria-hidden="true">□</span><h2>保存した作品はまだありません</h2>
              <p>作品を作り、画面上部の「保存」を押すとここに並びます。</p>
              <button className="primary-button" type="button" onClick={onNew}>新しい作品を作る</button>
            </section>
          ) : (
            <section className="my-boxes-grid" aria-label="保存した作品">
              {projects.map((project) => (
                <article className="panel-card my-box-card" key={project.id}>
                  <button className="my-box-open" type="button" disabled={busyId === project.id} onClick={() => onOpen(project)}>
                    <span className="my-box-icon" aria-hidden="true">▱</span>
                    <span><strong>{project.name}</strong><small>{BOX_NAMES[project.boxType]}</small></span>
                  </button>
                  <dl><div><dt>サイズ</dt><dd>{project.widthMm} × {project.heightMm} × {project.depthMm}mm</dd></div><div><dt>更新</dt><dd>{formatDate(project.updatedAt)}</dd></div></dl>
                  <div className="my-box-actions">
                    <button type="button" disabled={Boolean(busyId)} onClick={() => rename(project)}>名前変更</button>
                    <button type="button" disabled={Boolean(busyId)} onClick={() => duplicate(project)}>複製</button>
                    <button className="danger" type="button" disabled={Boolean(busyId)} onClick={() => remove(project)}>削除</button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
