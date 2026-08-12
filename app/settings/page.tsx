"use client";

import {
  CheckCircle2,
  FolderOpen,
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
  watchlistCount?: number;
  uniqueArticleSymbols?: number;
  error?: string;
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "操作失败";
}

export default function SettingsPage() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/vault/import", { cache: "no-store" });
        const data = (await response.json()) as VaultStatus;
        if (!active) return;
        if (!response.ok && !data.resolved) {
          throw new Error(data.error || "Vault 状态加载失败");
        }
        setStatus(data);
        setPathInput(data.configured || data.resolved || "");
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
      };
      await refreshStatus();
      setMessage(
        `已导入 ${payload.imported} 只股票（核心 ${payload.core} · 观察 ${payload.watch}）。`,
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
          <p className="page-subtitle">配置 Obsidian Vault 路径，并将 stocks-index 导入自选股。</p>
        </div>
      </header>

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
                <small>核心 / 观察</small>
                <strong>
                  {status?.coreCount ?? 0} / {status?.watchCount ?? 0}
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

            {message && (
              <div className="inline-notice">
                <CheckCircle2 size={14} /> {message}
              </div>
            )}
            {(error || status?.error) && (
              <div className="inline-error">{error || status?.error}</div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
