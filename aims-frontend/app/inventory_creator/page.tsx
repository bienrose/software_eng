"use client";

import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { ArrowRight, Bell, Boxes, ClipboardList, Home, LogOut, Sparkles, TrendingUp, WandSparkles } from "lucide-react";
import logo from "../inventory/logo.png";
import "../styles/dashboard.css";
import styles from "./inventory-creator.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
];

export default function InventoryCreatorPage() {
  return (
    <main className={`${poppins.className} app-shell`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src={logo} alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory_creator"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Inventory Creator</h1><p className="topbar-subtitle">Choose how you want to set up an inventory</p></div><div className={styles.topbarBadge}><Sparkles size={14} /><span>Inventory setup</span></div></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={styles.choiceIntro}>
                <div className={styles.eyebrow}><WandSparkles size={15} /><span>Start with the method that suits you</span></div>
                <h2>Create an inventory</h2>
                <p>Build your inventory item by item, or describe what you need and preview a suggested structure.</p>
              </div>

              <div className={styles.choiceGrid}>
                <Link href="/inventory_creator/manual" className={styles.modeCard}>
                  <div className={styles.modeTop}><span className={`${styles.modeIcon} ${styles.manualIcon}`}><ClipboardList size={21} /></span><span className={styles.modeArrow}><ArrowRight size={16} /></span></div>
                  <span className={styles.modeEyebrow}>Direct setup</span>
                  <h3>Manual</h3>
                  <p>Add items one by one with their category, quantity, and unit. Best when you already know exactly what to enter.</p>
                  <span className={styles.modeAction}>Enter items manually <ArrowRight size={14} /></span>
                </Link>

                <Link href="/inventory_creator/automatic" className={styles.modeCard}>
                  <div className={styles.modeTop}><span className={`${styles.modeIcon} ${styles.automaticIcon}`}><Sparkles size={21} /></span><span className={styles.modeArrow}><ArrowRight size={16} /></span></div>
                  <span className={styles.modeEyebrow}>Adaptive setup</span>
                  <h3>Automatic</h3>
                  <p>Describe the inventory in plain language and preview suggested fields tailored to what you need to track.</p>
                  <span className={styles.modeAction}>Describe your needs <ArrowRight size={14} /></span>
                </Link>
              </div>

              <div className={styles.choiceHint}><Boxes size={16} /><p>You can review your inventory structure before adding it to your workspace.</p></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
