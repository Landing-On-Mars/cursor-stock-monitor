"use client";

import { FolderOpen, Settings } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type VaultStatus = {
  ok: boolean;
  path: string | null;
  savedPath: string;
  source: "env" | "saved" | "auto" | null;
  stockCount: number;
  articleCount: number;
  error?: string;
};

const sourceText = {
  env: "来自环境变量 VAULT_PATH",
  saved: "已记住这台电脑的路径",
  auto: "自动找到的默认目录",
};

export default function SettingsPage() {
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/vault/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<VaultStatus>)
      .then((status) => {
        setVault(status);
        setInput(status.savedPath || status.path || "");
      })
      .catch(() =>
        setVault({
          ok: false,
          path: null,
          savedPath: "",
          source: null,
          stockCount: 0,
          articleCount: 0,
        }),
      );
  }, []);

  async function saveVault(vaultPath: string) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/vault/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath }),
      });
      const body = (await response.json()) as VaultStatus;
      if (!response.ok) throw new Error(body.error ?? "保存失败。");
      setVault(body);
      setInput(body.savedPath || body.path || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>设置</h1>
          <p className="page-subtitle">
            办公室和家里各填一次 Google Drive 里的 Vault 路径，保存在这台电脑上。
          </p>
        </div>
      </header>

      <section className="card settings-card">
        <div className="card-head" style={{ padding: 0, border: 0, marginBottom: 16 }}>
          <div>
            <h2>Obsidian Vault</h2>
            <p>选含有 Stocks 和 Articles 的根目录。保存后会把 Stocks 里的个股导入股票池。每台电脑各自记住，互不影响。</p>
          </div>
          <span className="icon-box"><FolderOpen size={15} /></span>
        </div>

        <form className="settings-form" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void saveVault(input);
        }}>
          <label className="field field-full">
            <span>Vault 路径</span>
            <input
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如 G:\我的云端硬盘\Journal 或 C:\Users\ht.tu\Google Drive\Journal"
              value={input}
            />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <div className="settings-actions">
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? "正在保存…" : "保存并记住"}
            </button>
            <button
              className="btn"
              disabled={saving}
              onClick={() => void saveVault("")}
              type="button"
            >
              清空（改回自动查找）
            </button>
          </div>
        </form>

        {vault?.ok ? (
          <>
            <p className="muted-copy" style={{ marginTop: 16 }}>
              当前使用：{vault.path}
              {vault.source ? ` · ${sourceText[vault.source]}` : ""}
            </p>
            <div className="metric-row" style={{ marginBottom: 0 }}>
              <div className="metric"><small>个股页</small><strong>{vault.stockCount}</strong></div>
              <div className="metric"><small>文章</small><strong>{vault.articleCount}</strong></div>
            </div>
          </>
        ) : (
          <div className="empty-settings" style={{ padding: "28px 0 8px" }}>
            <span className="icon-box" style={{ height: 42, width: 42 }}><Settings size={20} /></span>
            <h2>还没有找到 Vault</h2>
            <p>
              在资源管理器中打开 Google Drive 里的 Journal，复制地址栏完整路径贴到上面。
              办公室和家里各保存一次即可。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
