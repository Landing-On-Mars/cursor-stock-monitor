"use client";

import { FolderOpen, Settings } from "lucide-react";
import { useEffect, useState } from "react";

type VaultStatus = {
  ok: boolean;
  path: string | null;
  stockCount: number;
  articleCount: number;
};

export default function SettingsPage() {
  const [vault, setVault] = useState<VaultStatus | null>(null);

  useEffect(() => {
    fetch("/api/vault/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<VaultStatus>)
      .then(setVault)
      .catch(() => setVault({ ok: false, path: null, stockCount: 0, articleCount: 0 }));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>设置</h1>
          <p className="page-subtitle">个股研究页从 Vault 读 Markdown，不在网页里接 AI API。</p>
        </div>
      </header>

      <section className="card" style={{ padding: 22 }}>
        <div className="card-head" style={{ padding: 0, border: 0, marginBottom: 16 }}>
          <div>
            <h2>Obsidian Vault</h2>
            <p>默认找与本项目同级的 investment-vault，或环境变量 VAULT_PATH</p>
          </div>
          <span className="icon-box"><FolderOpen size={15} /></span>
        </div>
        {vault?.ok ? (
          <>
            <p className="muted-copy">{vault.path}</p>
            <div className="metric-row" style={{ marginBottom: 0 }}>
              <div className="metric"><small>个股页</small><strong>{vault.stockCount}</strong></div>
              <div className="metric"><small>文章</small><strong>{vault.articleCount}</strong></div>
            </div>
          </>
        ) : (
          <div className="empty-settings" style={{ padding: 28 }}>
            <span className="icon-box" style={{ height: 42, width: 42 }}><Settings size={20} /></span>
            <h2>还没有找到 Vault</h2>
            <p>
              把研究库放到 <code>../investment-vault</code>，或在运行前设置
              <code> VAULT_PATH</code> 指向你的 Journal 目录。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
