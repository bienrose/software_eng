"use client";

import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../styles/dashboard.css";
import {
  Home,
  Boxes,
  Sparkles,
  TrendingUp,
  Bell,
  LogOut,
  PenLine,
  Wand2,
  ArrowRight,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// ---------------------------------------------------------------------------
// Data — swap for your API / DB results in production.
// ---------------------------------------------------------------------------

type NavItem = { href: string; label: string; icon: typeof Home };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory-creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
];

const user = { name: "John Doe", role: "Administrator" };

const card =
  "rounded-2xl border border-[#b8d2bd] bg-white shadow-[0_4px_12px_rgba(20,92,50,0.08),0_1px_3px_rgba(20,92,50,0.06)]";

const surfaceShadow =
  "shadow-[0_1px_3px_rgba(20,92,50,0.08),0_1px_2px_rgba(20,92,50,0.04)]";

const options = [
  {
    href: "/inventory/manual",
    icon: PenLine,
    title: "Manual Input",
    description:
      "Type in item names, categories, and quantities one by one. Best when you already know exactly what you're adding.",
    cta: "Start manual input",
  },
  {
    href: "/inventory-creator",
    icon: Wand2,
    title: "Inventory Creator",
    description:
      "Describe what you need in plain language and let the platform draft a full category structure for you.",
    cta: "Open inventory creator",
  },
];

export default function InventoryPage() {
  return (
    <main className={`${poppins.className} min-h-screen bg-[#f5f8f6] text-[#145c32]`}>
      <div className="flex min-h-screen">
        {/* SIDEBAR — uses classes from dashboard.css */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Image
              src={logo}
              alt="AIMS logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <p className="sidebar-brand-name">AIMS</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const active = item.href === "/inventory";
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${active ? " is-active" : ""}`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">JD</div>
              <div className="min-w-0">
                <p className="sidebar-user-name">{user.name}</p>
                <p className="sidebar-user-role">{user.role}</p>
              </div>
            </div>
            <button className="sidebar-logout">
              <LogOut size={14} strokeWidth={1.75} />
              Log out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* TOP BAR */}
          <header
            className={`flex h-[64px] items-center justify-between border-b border-[#b8d2bd] bg-white px-6 lg:px-8 ${surfaceShadow}`}
          >
            <div>
              <h1 className="text-[17px] font-bold tracking-tight">Inventory</h1>
              <p className="mt-0.5 text-[11px] text-[#718675]">
                Choose how you want to add items
              </p>
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#b8d2bd] text-[#718675] transition-colors hover:bg-[#e8f5e9] hover:text-[#145c32]"
              title="Notifications"
            >
              <Bell size={16} strokeWidth={1.75} />
            </button>
          </header>

          {/* CONTENT */}
          <div className="flex-1 px-6 py-10 lg:px-10">
            <div className="mx-auto w-full max-w-[960px]">
              {/* HEADER BLOCK — centered */}
              <div className="mb-8 flex flex-col items-center text-center">
                <h2 className="mt-8 text-[24px] font-bold tracking-tight text-[#145c32] lg:text-[28px]">
                  Choose what type of inventory creation
                </h2>
                <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-[#718675]">
                  Pick how you want to build out your inventory.
                </p>
              </div>

              {/* OPTION CARDS */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {options.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.href}
                      className={`${card} group flex flex-col items-center p-6 text-center transition-colors hover:border-[#145c32]`}
                    >
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f5e9] text-[#145c32]">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>

                      <h3 className="text-[18px] font-bold text-[#145c32]">
                        {option.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#718675]">
                        {option.description}
                      </p>

                      <Link
                        href={option.href}
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#145c32] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0f4d29]"
                      >
                        {option.cta}
                        <ArrowRight
                          size={14}
                          strokeWidth={2}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </Link>
                    </div>
                  );
                })}
              </div>

              <p className="mt-8 text-center text-[11px] text-[#718675]">
                Not sure? The inventory creator is faster if you already have a rough list.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}