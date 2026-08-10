import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Preferences</p><h1>设置</h1><p className="page-subtitle">后续在这里配置行情源、Obsidian vault、同步与通知。</p></div>
      </header>
      <section className="card empty-settings">
        <span className="icon-box" style={{ height: 42, width: 42 }}><Settings size={20} /></span>
        <h2>数据连接将在下一阶段接入</h2>
        <p>当前网页框架使用演示数据。接入后，你可以在这里管理各市场行情 API、Vault 路径和每日预警时间。</p>
      </section>
    </div>
  );
}
