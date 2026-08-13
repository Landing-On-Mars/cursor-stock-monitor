import { ExternalLink } from "lucide-react";
import { ResearchWorkspace } from "@/components/research-workspace";

type ResearchPageProps = {
  searchParams?: Promise<{ symbol?: string }>;
};

export default async function ResearchPage({ searchParams }: ResearchPageProps) {
  const params = searchParams ? await searchParams : {};
  const initialSymbol = params.symbol?.trim().toUpperCase() || null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Research Library</p>
          <h1>个股研究</h1>
          <p className="page-subtitle">
            自选来自看板数据库；研究笔记读写 Google Drive 里的 Vault，可与 Obsidian 同开。
          </p>
        </div>
        <div className="header-actions">
          <a className="btn" href="/settings">
            <ExternalLink size={14} />
            设置
          </a>
        </div>
      </header>
      <ResearchWorkspace initialSymbol={initialSymbol} />
    </div>
  );
}
