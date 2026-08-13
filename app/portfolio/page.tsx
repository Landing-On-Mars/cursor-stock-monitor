import { BellRing, Download, Plus, Settings2 } from "lucide-react";

const holdings = [
  ["NV", "NVDA", "NVIDIA", "美股", "120", "$156.24", "$182.41", "+16.75%", "41.2%"],
  ["腾", "0700", "腾讯控股", "港股", "500", "HK$482.10", "HK$562.00", "+16.57%", "26.4%"],
  ["茅", "600519", "贵州茅台", "A股", "100", "¥1,512.40", "¥1,438.80", "-4.87%", "16.8%"],
  ["MS", "MSFT", "Microsoft", "美股", "45", "$427.60", "$452.18", "+5.75%", "10.1%"],
  ["现", "CASH", "现金", "CNY", "—", "—", "¥70,655", "—", "5.5%"],
];

export default function PortfolioPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Portfolio & Alerts</p><h1>组合管理</h1><p className="page-subtitle">跟踪持仓、风险暴露与每日规则预警。</p></div>
        <div className="header-actions"><button className="btn"><Download size={14} />导入持仓</button><button className="btn btn-primary"><Plus size={14} />添加标的</button></div>
      </header>
      <section className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>组合市值</span></div><div className="stat-value">¥1,284,650</div><div className="stat-note positive">今日 +¥15,982</div></div>
        <div className="stat-card"><div className="stat-top"><span>累计收益</span></div><div className="stat-value positive">+13.26%</div><div className="stat-note">投入成本 ¥1,134,260</div></div>
        <div className="stat-card"><div className="stat-top"><span>最大回撤</span></div><div className="stat-value negative">-8.42%</div><div className="stat-note">发生于 2026 年 4 月</div></div>
        <div className="stat-card"><div className="stat-top"><span>活跃规则</span></div><div className="stat-value">8</div><div className="stat-note">今日触发 3 条</div></div>
      </section>
      <section className="content-grid">
        <div className="stack">
          <article className="card">
            <div className="card-head"><div><h2>当前持仓</h2><p>跨市场折算为人民币</p></div><span className="text-link">汇率更新于 16:10</span></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>标的</th><th>市场</th><th>数量</th><th>成本</th><th>现价</th><th>收益</th><th>仓位</th></tr></thead>
                <tbody>{holdings.map(([icon, symbol, name, market, amount, cost, price, profit, weight]) => (
                  <tr key={symbol}>
                    <td><div className="symbol-cell"><span className="market-icon">{icon}</span><div><strong>{symbol}</strong><small>{name}</small></div></div></td>
                    <td>{market}</td><td>{amount}</td><td>{cost}</td><td>{price}</td>
                    <td className={profit.startsWith("+") ? "positive" : profit.startsWith("-") ? "negative" : ""}>{profit}</td><td><strong>{weight}</strong></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </article>
          <article className="card">
            <div className="card-head"><div><h2>预警规则</h2><p>每个交易日收盘后执行</p></div><button className="btn"><Settings2 size={13} />配置</button></div>
            <div className="alert-row"><span className="alert-symbol"><BellRing size={14} /></span><div className="row-main"><strong>跌破 5 日移动均线</strong><small>适用于全部持仓 · 每日收盘</small></div><span className="status status-red">2 条触发</span></div>
            <div className="alert-row"><span className="alert-symbol" style={{ background: "var(--green-soft)", color: "var(--green)" }}><BellRing size={14} /></span><div className="row-main"><strong>放量突破 20 日高点</strong><small>成交量须高于 20 日均量 1.5 倍</small></div><span className="status status-green">运行中</span></div>
            <div className="alert-row"><span className="alert-symbol" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}><BellRing size={14} /></span><div className="row-main"><strong>接近目标价格</strong><small>距离研究笔记中的目标价小于 5%</small></div><span className="status status-amber">1 条观察</span></div>
          </article>
        </div>
        <aside className="stack">
          <article className="card">
            <div className="card-head"><div><h2>资产分布</h2><p>按当前市值</p></div></div>
            <div className="allocation">
              <div className="donut" />
              <div className="legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: "#285c47" }} />美股<b>51.3%</b></div>
                <div className="legend-item"><span className="legend-dot" style={{ background: "#638a77" }} />港股<b>26.4%</b></div>
                <div className="legend-item"><span className="legend-dot" style={{ background: "#afc5b8" }} />A股<b>16.8%</b></div>
                <div className="legend-item"><span className="legend-dot" style={{ background: "#d9e4dd" }} />现金<b>5.5%</b></div>
              </div>
            </div>
          </article>
          <article className="card" style={{ padding: 18 }}>
            <div className="obsidian-label"><BellRing size={13} /> 推送渠道</div>
            <h3 style={{ fontSize: 13, margin: "13px 0 6px" }}>Telegram 已连接</h3>
            <p style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.6, margin: 0 }}>预警将在各市场收盘扫描完成后发送，同时写入 Obsidian 的 alerts 目录。</p>
          </article>
        </aside>
      </section>
    </div>
  );
}
