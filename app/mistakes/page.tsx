import { BookMarked, Calendar, Filter, Plus, Search } from "lucide-react";

const mistakes = [
  { market: "AAPL", type: "追高", date: "2026-08-07", title: "忽略大盘环境，突破当日追高", body: "看到放量突破后直接买入，没有等待回踩确认，也忽略了纳指当日弱势。", pnl: "-3.2%", level: "status-red" },
  { market: "0700", type: "过早止盈", date: "2026-07-29", title: "因为短期盈利提前卖出核心仓", body: "基本面逻辑没有变化，只因浮盈回撤产生焦虑，偏离了原计划的持有条件。", pnl: "-8.6% 机会成本", level: "status-amber" },
  { market: "600519", type: "仓位", date: "2026-07-18", title: "单一标的仓位超过预设上限", body: "连续加仓后组合暴露失衡，未在交易前检查总仓位与相关性。", pnl: "-2.1%", level: "status-red" },
  { market: "NVDA", type: "计划外交易", date: "2026-07-08", title: "盘中临时起意，没有明确止损", body: "被短线价格波动吸引，入场前没有写下交易逻辑和失效条件。", pnl: "-1.4%", level: "status-red" },
  { market: "9988", type: "确认偏误", date: "2026-06-22", title: "只收集支持持仓的信息", body: "忽视竞争格局变化，复盘时发现研究材料明显偏向已有观点。", pnl: "-4.7%", level: "status-amber" },
  { market: "MSFT", type: "执行偏差", date: "2026-06-10", title: "计划价格到了，却没有执行", body: "临场担心继续下跌，错过事先测算过赔率的买点。", pnl: "+6.3% 错失", level: "status-green" },
];

export default function MistakesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Trading Journal</p><h1>交易错题本</h1><p className="page-subtitle">诚实记录每一次偏差，把重复犯错变成可见的数据。</p></div>
        <button className="btn btn-primary"><Plus size={14} />记录一笔错题</button>
      </header>
      <section className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>累计记录</span><BookMarked size={15} /></div><div className="stat-value">36</div><div className="stat-note">今年新增 21 条</div></div>
        <div className="stat-card"><div className="stat-top"><span>最常见错误</span></div><div className="stat-value" style={{ fontSize: 19 }}>计划外交易</div><div className="stat-note">出现 8 次 · 占 22%</div></div>
        <div className="stat-card"><div className="stat-top"><span>连续无重复</span></div><div className="stat-value">14 天</div><div className="stat-note positive">比上月提高 6 天</div></div>
        <div className="stat-card"><div className="stat-top"><span>本月复盘</span></div><div className="stat-value">5 / 7</div><div className="progress-bar"><span style={{ width: "71%" }} /></div></div>
      </section>
      <div className="toolbar">
        <label className="search-field"><Search size={15} /><input placeholder="搜索错题…" /></label>
        <button className="btn"><Calendar size={14} />今年</button><button className="btn"><Filter size={14} />全部类型</button>
      </div>
      <section className="mistake-grid">
        {mistakes.map((item) => (
          <article className="card mistake-card" key={item.title}>
            <div className="mistake-meta"><span className="status status-green">{item.market}</span><span className={`status ${item.level}`}>{item.type}</span></div>
            <h3>{item.title}</h3><p>{item.body}</p>
            <div className="mistake-footer"><span>{item.date} · 已同步 Obsidian</span><strong className={item.pnl.startsWith("-") ? "negative" : "positive"}>{item.pnl}</strong></div>
          </article>
        ))}
      </section>
    </div>
  );
}
