import { ExternalLink } from "lucide-react";
import { ResearchWorkspace } from "@/components/research-workspace";

export default function ResearchPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Research Library</p>
          <h1>个股研究</h1>
          <p className="page-subtitle">
            从 investment-vault 导入自选股，对照 thesis 与关联文章。
          </p>
        </div>
        <div className="header-actions">
          <a className="btn" href="/settings">
            <ExternalLink size={14} />
            Vault 设置
          </a>
        </div>
      </header>
      <ResearchWorkspace />
    </div>
  );
}
