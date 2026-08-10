import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { MarketChart } from "@/components/market-chart";

const watchlist = [
  { market: "US", symbol: "NVDA", name: "NVIDIA", price: "$182.41", change: "+2.84%" },
  { market: "HK", symbol: "0700", name: "腾讯控股", price: "HK$562.00", change: "+1.17%" },
  { market: "CN", symbol: "600519", name: "贵州茅台", price: "¥1,438.80", change: "-0.63%" },
];

export default function Dashboard() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Monday · 10 Aug 2026</p>
          <h1>早上好，开始今天的复盘。</h1>
          <p className="page-subtitle">市场数据已更新，今日有 3 条组合规则触发。</p>
        </div>
        <div className="header-actions">
          <button className="btn"><RefreshCw size={14} />同步数据</button>
          <Link className="btn btn-primary" href="/mistakes"><BookOpenText size={14} />记录交易</Link>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top"><span>组合市值</span><span className="icon-box"><BriefcaseBusiness size={15} /></span></div>
          <div className="stat-value">¥ 1,284,650</div>
          <div className="stat-note positive">↑ 1.26% 今日 · +¥15,982</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>本月收益</span><span className="icon-box"><TrendingUp size={15} /></span></div>
          <div className="stat-value positive">+4.82%</div>
          <div className="stat-note">沪深 300 同期 +1.35%</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>今日预警</span><span className="icon-box"><AlertTriangle size={15} /></span></div>
          <div className="stat-value">3</div>
          <div className="stat-note negative">2 条需要关注 · 1 条观察</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>检查完成度</span><span className="icon-box"><CheckCircle2 size={15} /></span></div>
          <div className="stat-value">7 / 10</div>
          <div className="progress-bar"><span style={{ width: "70%" }} /></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack">
          <article className="card">
            <div className="card-head">
              <div><h2>组合走势</h2><p>近一个月 · CNY</p></div>
              <div className="chart-tabs"><button>1周</button><button className="active">1月</button><button>3月</button><button>1年</button></div>
            </div>
            <div className="chart-summary">
              <span className="chart-price">+4.82%</span>
              <span className="chip">跑赢基准 3.47%</span>
            </div>
            <MarketChart />
          </article>

          <article className="card">
            <div className="card-head"><div><h2>最近研究笔记</h2><p>来自 Obsidian vault</p></div><Link href="/research" className="text-link">查看全部</Link></div>
            <div className="notes-list">
              <div className="note-row"><span className="market-icon">NV</span><div className="row-main"><strong>NVIDIA FY2027 Q2 跟踪</strong><small>AI 推理需求与 Blackwell Ultra 出货节奏</small></div><span className="tag">半导体</span><time>昨天</time></div>
              <div className="note-row"><span className="market-icon">腾</span><div className="row-main"><strong>腾讯：游戏恢复与广告增量</strong><small>视频号商业化仍是主要增长变量</small></div><span className="tag">互联网</span><time>3 天前</time></div>
              <div className="note-row"><span className="market-icon">茅</span><div className="row-main"><strong>茅台渠道库存观察</strong><small>批价企稳，但经销商回款压力仍在</small></div><span className="tag">消费</span><time>5 天前</time></div>
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="card">
            <div className="card-head"><div><h2>规则预警</h2><p>收盘后自动扫描</p></div><Link href="/portfolio" className="text-link">管理规则</Link></div>
            <div className="alert-row"><span className="alert-symbol"><TrendingUp size={14} /></span><div className="row-main"><strong>贵州茅台</strong><small>600519 · A股</small></div><span className="alert-rule">跌破 5 日线</span></div>
            <div className="alert-row"><span className="alert-symbol"><TrendingUp size={14} /></span><div className="row-main"><strong>Apple</strong><small>AAPL · 美股</small></div><span className="alert-rule">放量下跌</span></div>
            <div className="alert-row"><span className="alert-symbol" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}><CircleDollarSign size={14} /></span><div className="row-main"><strong>腾讯控股</strong><small>0700 · 港股</small></div><span className="status status-amber">接近止盈线</span></div>
          </article>

          <article className="card">
            <div className="card-head"><div><h2>重点观察</h2><p>跨市场自选股</p></div><ArrowUpRight size={14} color="#758078" /></div>
            {watchlist.map((item) => (
              <div className="watch-row" key={item.symbol}>
                <span className="market-icon">{item.market}</span>
                <div className="row-main"><strong>{item.symbol}</strong><small>{item.name}</small></div>
                <div className="row-value">{item.price}<small className={item.change.startsWith("+") ? "positive" : "negative"}>{item.change}</small></div>
              </div>
            ))}
          </article>

          <Link className="card" href="/checklist" style={{ padding: 16, display: "flex", alignItems: "center", gap: 11 }}>
            <span className="icon-box"><CalendarDays size={15} /></span>
            <div className="row-main"><strong>收盘后检查</strong><small>还剩 3 项 · 预计 5 分钟</small></div>
            <ChevronRight size={16} color="#929a94" />
          </Link>
        </div>
      </section>
    </div>
  );
}
