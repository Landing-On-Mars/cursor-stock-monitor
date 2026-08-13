"use client";

import {
  CheckCircle2,
  Database,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Settings,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type VaultStatus = {
  configured: string | null;
  resolved: string | null;
  available: boolean;
  stockCount?: number;
  coreCount?: number;
  watchCount?: number;
  archiveCount?: number;
  watchlistCount?: number;
  uniqueArticleSymbols?: number;
  error?: string;
};

type DatabaseStatus = {
  available: boolean;
  configuredDir: string | null;
  envOverride: string | null;
  filePath: string;
  filename: string;
  journalMode: string;
  sizeBytes: number;
  syncFolder: boolean;
  watchlistCount: number;
  error?: string;
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "操作失败";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [databaseDirInput, setDatabaseDirInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDatabase, setSavingDatabase] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshStatus() {
    const response = await fetch("/api/vault/import", { cache: "no-store" });
    const data = (await response.json()) as VaultStatus;
    if (!response.ok && !data.resolved) {
      throw new Error(data.error || (await readError(response)));
    }
    setStatus(data);
    setPathInput(data.configured || data.resolved || "");
  }

  async function refreshDatabase() {
    const response = await fetch("/api/database/config", { cache: "no-store" });
    const data = (await response.json()) as DatabaseStatus & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || (await readError(response)));
    }
    setDatabaseStatus(data);
    setDatabaseDirInput(data.configuredDir || data.filePath || "");
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [vaultResponse, databaseResponse] = await Promise.all([
          fetch("/api/vault/import", { cache: "no-store" }),
          fetch("/api/database/config", { cache: "no-store" }),
        ]);
        const data = (await vaultResponse.json()) as VaultStatus;
        const databaseData = (await databaseResponse.json()) as DatabaseStatus & {
          error?: string;
        };
        if (!active) return;
        if (!vaultResponse.ok && !data.resolved) {
          throw new Error(data.error || "Vault 状态加载失败");
        }
        if (!databaseResponse.ok) {
          throw new Error(databaseData.error || "数据库状态加载失败");
        }
        setStatus(data);
        setPathInput(data.configured || data.resolved || "");
        setDatabaseStatus(databaseData);
        setDatabaseDirInput(databaseData.configuredDir || databaseData.filePath || "");
      } catch (requestError: unknown) {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : "状态加载失败",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function savePath(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/vault/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathInput }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await refreshStatus();
      setMessage("Vault 路径已保存。");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveDatabaseDir(event: FormEvent) {
    event.preventDefault();
    setSavingDatabase(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/database/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: databaseDirInput }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await refreshDatabase();
      setMessage("数据库同步文件夹已保存。Google Drive 同步完成后，另一台电脑填同一文件夹即可。");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSavingDatabase(false);
    }
  }

  async function importVault() {
    setImporting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: false }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = (await response.json()) as {
        imported: number;
        core: number;
        watch: number;
        archive: number;
      };
      await Promise.all([refreshStatus(), refreshDatabase()]);
      setMessage(
        `已导入 ${payload.imported} 只股票（核心 ${payload.core} · 观察 ${payload.watch} · 路人 ${payload.archive}）。`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>设置</h1>
          <p className="page-subtitle">
            指定 Google Drive 同步文件夹存放数据库，并配置 Obsidian Vault 路径。
          </p>
        </div>
      </header>

      <section className="card settings-panel">
        <div className="card-head">
          <div>
            <h2>数据库同步文件夹</h2>
            <p>把 SQLite 放到 Google Drive 镜像目录，家里和办公室共用一份 dashboard.db</p>
          </div>
          <span className="icon-box">
            <HardDrive size={15} />
          </span>
        </div>

        {loading ? (
          <div className="watchlist-empty">
            <LoaderCircle className="spin" size={18} />
            <span>正在检测数据库…</span>
          </div>
        ) : (
          <>
            <div className="settings-status">
              <div className="metric">
                <small>状态</small>
                <strong className={databaseStatus?.available ? "positive" : "negative"}>
                  {databaseStatus?.available ? "已连接" : "未找到"}
                </strong>
              </div>
              <div className="metric">
                <small>文件大小</small>
                <strong>{formatBytes(databaseStatus?.sizeBytes ?? 0)}</strong>
              </div>
              <div className="metric">
                <small>自选数量</small>
                <strong>{databaseStatus?.watchlistCount ?? 0}</strong>
              </div>
              <div className="metric">
                <small>同步方式</small>
                <strong>{databaseStatus?.syncFolder ? "Google Drive 文件夹" : "本机 data"}</strong>
              </div>
            </div>

            <form className="settings-form" onSubmit={saveDatabaseDir}>
              <label className="field field-full">
                <span>Google Drive 文件夹</span>
                <div className="stock-search-input">
                  <Database size={15} />
                  <input
                    disabled={Boolean(databaseStatus?.envOverride)}
                    onChange={(event) => setDatabaseDirInput(event.target.value)}
                    placeholder="G:\我的云端硬盘\Northstar  或  H:\Northstar"
                    value={databaseDirInput}
                  />
                </div>
              </label>
              <p className="settings-hint">
                填桌面客户端的<strong>镜像</strong>文件夹（不要用流式文件）。两台电脑各填自己的本地路径，文件名都是
                <code>{databaseStatus?.filename || "dashboard.db"}</code>
                。不要两边同时开 Northstar。当前文件：
                <code>{databaseStatus?.filePath || "—"}</code>
                {databaseStatus?.envOverride ? (
                  <>
                    {" "}
                    环境变量 <code>DATABASE_PATH</code> 已覆盖此设置。
                  </>
                ) : null}
              </p>
              <div className="modal-actions" style={{ padding: "0 0 4px" }}>
                <button
                  className="btn btn-primary"
                  disabled={savingDatabase || Boolean(databaseStatus?.envOverride)}
                  type="submit"
                >
                  {savingDatabase ? "保存中…" : "保存同步文件夹"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="card settings-panel">
        <div className="card-head">
          <div>
            <h2>Investment Vault</h2>
            <p>只读扫描 Stocks/CN · HK · US 与 Articles，不修改 Vault 文件</p>
          </div>
          <span className="icon-box">
            <Settings size={15} />
          </span>
        </div>

        {loading ? (
          <div className="watchlist-empty">
            <LoaderCircle className="spin" size={18} />
            <span>正在检测 Vault…</span>
          </div>
        ) : (
          <>
            <div className="settings-status">
              <div className="metric">
                <small>状态</small>
                <strong className={status?.available ? "positive" : "negative"}>
                  {status?.available ? "已连接" : "未找到"}
                </strong>
              </div>
              <div className="metric">
                <small>索引股票</small>
                <strong>{status?.stockCount ?? 0}</strong>
              </div>
              <div className="metric">
                <small>核心 / 观察 / 路人</small>
                <strong>
                  {status?.coreCount ?? 0} / {status?.watchCount ?? 0} /{" "}
                  {status?.archiveCount ?? 0}
                </strong>
              </div>
              <div className="metric">
                <small>当前自选</small>
                <strong>{status?.watchlistCount ?? 0}</strong>
              </div>
            </div>

            <form className="settings-form" onSubmit={savePath}>
              <label className="field field-full">
                <span>Vault 路径</span>
                <div className="stock-search-input">
                  <FolderOpen size={15} />
                  <input
                    onChange={(event) => setPathInput(event.target.value)}
                    placeholder="/path/to/investment-vault"
                    value={pathInput}
                  />
                </div>
              </label>
              <p className="settings-hint">
                也可设置环境变量 <code>VAULT_PATH</code>。当前解析：
                <code>{status?.resolved || "—"}</code>
                。文章仍在 Vault 里，不同步进 dashboard.db。
              </p>
              <div className="modal-actions" style={{ padding: "0 0 4px" }}>
                <button className="btn" disabled={saving} type="submit">
                  {saving ? "保存中…" : "保存路径"}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={importing || !status?.available}
                  onClick={() => void importVault()}
                  type="button"
                >
                  {importing ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {importing ? "导入中…" : "导入 75 只股票"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {message && (
        <div className="inline-notice">
          <CheckCircle2 size={14} /> {message}
        </div>
      )}
      {(error || status?.error || databaseStatus?.error) && (
        <div className="inline-error">
          {error || status?.error || databaseStatus?.error}
        </div>
      )}
    </div>
  );
}
