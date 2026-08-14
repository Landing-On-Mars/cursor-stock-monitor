"use client";

import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckSquare2,
  LayoutDashboard,
  Menu,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/research", label: "个股研究", icon: BookOpen },
  { href: "/mistakes", label: "交易错题本", icon: NotebookPen },
  { href: "/checklist", label: "交易检查", icon: CheckSquare2 },
  { href: "/portfolio", label: "组合管理", icon: BriefcaseBusiness },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("northstar-nav-collapsed") === "1";
  });

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("northstar-nav-collapsed", next ? "1" : "0");
  }

  useEffect(() => {
    document.documentElement.dataset.nav = collapsed ? "collapsed" : "expanded";
  }, [collapsed]);

  return (
    <>
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="打开菜单">
        <Menu size={21} />
      </button>
      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="关闭菜单" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <div>
            <strong>Northstar</strong>
            <small>投资工作台</small>
          </div>
          <button className="sidebar-collapse" onClick={toggleCollapsed} aria-label={collapsed ? "展开菜单" : "收起菜单"}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X size={19} /></button>
        </div>

        <button className="quick-search">
          <Search size={16} />
          <span>搜索股票或笔记</span>
          <kbd>⌘ K</kbd>
        </button>

        <nav>
          <p className="nav-label">工作台</p>
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={href} key={href} title={label} onClick={() => setOpen(false)}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
                {href === "/portfolio" && <i>3</i>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sync-card">
          <div className="sync-title"><span className="sync-dot" /> Obsidian 已同步</div>
          <p>刚刚更新 · 128 篇笔记</p>
        </div>
        <Link className="nav-item" href="/settings" title="设置">
          <Settings size={18} /><span>设置</span>
        </Link>
        <div className="profile">
          <span className="avatar">LM</span>
          <div><strong>Landing Mars</strong><small>个人空间</small></div>
          <Bell size={17} />
        </div>
      </aside>
    </>
  );
}
