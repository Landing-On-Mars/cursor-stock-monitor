"use client";

import { Check, Clock3, RotateCcw } from "lucide-react";
import { useState } from "react";

const groups = [
  {
    title: "盘前检查",
    subtitle: "开盘前确认市场环境和今日计划",
    items: [
      ["检查隔夜美股及宏观事件", "关注指数、利率、汇率和重要新闻"],
      ["确认今日财报与经济日历", "避免在重大事件前无计划持仓"],
      ["写下重点观察标的和价格", "最多 3 个，不临时扩大清单"],
      ["检查组合总仓位与风险暴露", "单一标的不超过 20%"],
    ],
  },
  {
    title: "下单前检查",
    subtitle: "任何买卖操作都必须完成",
    items: [
      ["交易逻辑可以用一句话说清", "明确为什么现在值得交易"],
      ["写下逻辑失效条件", "失效时执行，不与市场争论"],
      ["风险回报比至少为 2:1", "包含滑点和交易成本"],
      ["仓位符合预设上限", "根据止损距离反推仓位"],
    ],
  },
  {
    title: "收盘后复盘",
    subtitle: "用事实记录，不用盈亏评价决策",
    items: [
      ["核对成交与持仓变化", "更新组合和成本数据"],
      ["检查今日是否违反交易计划", "如有，立即写入错题本"],
      ["更新重点标的研究笔记", "记录新信息，不急于得出结论"],
      ["制定明日观察计划", "设定条件，不预测涨跌"],
    ],
  },
];

export default function ChecklistPage() {
  const [done, setDone] = useState<Set<string>>(new Set(["0-0", "0-1", "0-2", "1-0", "1-1", "2-0", "2-1"]));
  const toggle = (key: string) => setDone((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Daily Discipline</p><h1>交易检查</h1><p className="page-subtitle">2026 年 8 月 10 日，星期一 · 今日已完成 {done.size} / 12 项</p></div>
        <button className="btn" onClick={() => setDone(new Set())}><RotateCcw size={14} />重置今日检查</button>
      </header>
      <section className="card" style={{ padding: 17, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}><strong style={{ fontSize: 11 }}>今日总进度</strong><span className="positive" style={{ fontSize: 11 }}>{Math.round(done.size / 12 * 100)}%</span></div>
        <div className="progress-bar"><span style={{ width: `${done.size / 12 * 100}%` }} /></div>
      </section>
      <section className="check-layout">
        {groups.map((group, groupIndex) => (
          <article className="card check-section" key={group.title}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="icon-box"><Clock3 size={14} /></span><div><h2>{group.title}</h2><p style={{ margin: 0 }}>{group.subtitle}</p></div>
            </div>
            <div style={{ marginTop: 14 }}>
              {group.items.map(([title, detail], itemIndex) => {
                const key = `${groupIndex}-${itemIndex}`;
                const checked = done.has(key);
                return (
                  <div className="check-item" key={title}>
                    <button className={`checkbox ${checked ? "checked" : ""}`} onClick={() => toggle(key)} aria-label={checked ? "取消完成" : "标记完成"}>{checked && <Check size={13} />}</button>
                    <div><strong style={checked ? { textDecoration: "line-through", color: "#879089" } : undefined}>{title}</strong><small>{detail}</small></div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
