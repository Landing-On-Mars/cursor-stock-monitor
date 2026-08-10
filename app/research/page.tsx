import { ExternalLink, FileText, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { MarketChart } from "@/components/market-chart";

const notes = [
  ["NVIDIA FY2027 Q2 跟踪", "半导体 · 财报", "昨天"],
  ["AI 推理需求拆解", "产业研究", "8 月 6 日"],
  ["Blackwell 供应链更新", "供应链", "7 月 28 日"],
  ["数据中心毛利率敏感性", "估值模型", "7 月 19 日"],
];

export default function ResearchPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Research Library</p><h1>个股研究</h1><p className="page-subtitle">对照行情、基本面指标与 Obsidian 研究笔记。</p></div>
        <div className="header-actions"><button className="btn"><ExternalLink size={14} />在 Obsidian 打开</button><button className="btn btn-primary"><Plus size={14} />新建笔记</button></div>
      </header>
      <div className="toolbar">
        <label className="search-field"><Search size={15} /><input placeholder="输入代码、公司或笔记关键词…" /></label>
        <button className="btn"><Filter size={14} />全部市场</button>
        <button className="btn"><SlidersHorizontal size={14} />筛选</button>
      </div>
      <section className="content-grid">
        <div className="stack">
          <article className="card research-hero">
            <div className="ticker-head">
              <div className="ticker-title"><span className="ticker-badge">NV</span><div><h2>NVIDIA Corporation</h2><p>NASDAQ · NVDA · 美股</p></div></div>
              <div className="row-value" style={{ fontSize: 17 }}>$182.41<small className="positive">+2.84% 今日</small></div>
            </div>
            <div className="metric-row">
              <div className="metric"><small>市值</small><strong>$4.43T</strong></div>
              <div className="metric"><small>市盈率 TTM</small><strong>51.8×</strong></div>
              <div className="metric"><small>营收增长</small><strong className="positive">+69.2%</strong></div>
              <div className="metric"><small>毛利率</small><strong>71.6%</strong></div>
            </div>
            <div className="card-head" style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
              <div><h2>日线走势</h2><p>模拟行情 · 接入数据源后更新</p></div>
              <div className="chart-tabs"><button className="active">日线</button><button>周线</button><button>月线</button></div>
            </div>
            <MarketChart />
          </article>
          <article className="card markdown-preview">
            <div className="obsidian-label"><FileText size={13} /> stocks/US/NVDA.md</div>
            <h3>投资逻辑摘要</h3>
            <p>NVIDIA 正从训练侧的高速增长转向训练与推理双轮驱动。未来两个季度重点跟踪 Blackwell Ultra 的产能爬坡、推理 token 成本下降及云厂商资本开支指引。</p>
            <ul><li>护城河：CUDA 生态与软硬件协同</li><li>主要风险：客户自研芯片、出口限制、资本开支周期</li></ul>
          </article>
        </div>
        <aside className="card">
          <div className="card-head"><div><h2>关联笔记</h2><p>共 24 篇</p></div><span className="obsidian-label">OBSIDIAN</span></div>
          {notes.map(([title, tag, time]) => (
            <div className="note-row" key={title}><span className="market-icon"><FileText size={13} /></span><div className="row-main"><strong>{title}</strong><small>{tag}</small></div><time>{time}</time></div>
          ))}
        </aside>
      </section>
    </div>
  );
}
