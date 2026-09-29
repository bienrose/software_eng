"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../../styles/dashboard.css";
import {
  Home,
  Boxes,
  Sparkles,
  TrendingUp,
  Bell,
  LogOut,
  Trash2,
  SquarePen,
  Search,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type NavItem = { href: string; label: string; icon: typeof Home };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory-creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
];

type Stock = "in-stock" | "low-stock" | "out-of-stock";

const statusConfig: Record<Stock, { label: string; badge: string }> = {
  "in-stock": { label: "In stock", badge: "badge-in-stock" },
  "low-stock": { label: "Low stock", badge: "badge-low-stock" },
  "out-of-stock": { label: "Out of stock", badge: "badge-out-of-stock" },
};

type InventoryRow = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: Stock;
  updated: string;
};

const initialRows: InventoryRow[] = [
  {
    id: 1,
    name: "Family pack",
    category: "Food supplies",
    quantity: 250,
    unit: "packs",
    status: "low-stock",
    updated: "May 30, 2027",
  },
];

const user = { name: "John Doe", role: "Administrator" };

export default function ManualInventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>(initialRows);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const [searchItem, setSearchItem] = useState("");
  const [searchCategory, setSearchCategory] = useState("");

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !category || !quantity || !unit) return;

    const newRow: InventoryRow = {
      id: Date.now(),
      name,
      category,
      quantity: Number(quantity),
      unit,
      status: "in-stock",
      updated: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    setRows([newRow, ...rows]);
    setName("");
    setCategory("");
    setQuantity("");
    setUnit("");
  }

  function handleDelete(id: number) {
    setRows(rows.filter((r) => r.id !== id));
  }

  return (
    <main className={`${poppins.className} min-h-screen bg-[#f5f8f6] text-[#145c32]`}>
      <div className="flex min-h-screen">
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

        <section className="main">
          <header className="topbar">
            <div>
              <h1 className="topbar-title">Manual Inventory Input</h1>
              <p className="topbar-subtitle">
                Add items one by one to your inventory list
              </p>
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={16} strokeWidth={1.75} />
            </button>
          </header>

          <div className="page-content">
            <div className="page-inner stack-6">
              <form onSubmit={handleAddItem} className="panel panel-pad">
                <h2 className="panel-title">Add new item</h2>

                <div className="form-grid">
                  <div>
                    <label htmlFor="item-name" className="form-label">
                      Item Name
                    </label>
                    <input
                      id="item-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter item name"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="category" className="form-label">
                      Category
                    </label>
                    <input
                      id="category"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Enter category name"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="quantity" className="form-label">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="unit" className="form-label">
                      Unit
                    </label>
                    <input
                      id="unit"
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Enter unit"
                      className="form-input"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-block">
                  Add item
                </button>
              </form>

              <div className="panel panel-pad">
                <h2 className="panel-title">Inventory List</h2>

                <div className="search-row">
                  <input
                    type="text"
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    placeholder="Search item"
                    className="form-input is-item"
                  />
                  <input
                    type="text"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    placeholder="Category"
                    className="form-input is-category"
                  />
                  <button type="button" className="btn">
                    <Search size={14} strokeWidth={2} />
                    Search item
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th>Last Update</th>
                        <th className="is-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="is-empty">
                            No items yet. Add your first item above.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          const status = statusConfig[row.status];
                          return (
                            <tr key={row.id}>
                              <td className="is-strong">{row.name}</td>
                              <td className="is-muted">{row.category}</td>
                              <td className="is-strong">{row.quantity}</td>
                              <td className="is-muted">{row.unit}</td>
                              <td>
                                <span className={`badge ${status.badge}`}>
                                  {status.label}
                                </span>
                              </td>
                              <td className="is-muted">{row.updated}</td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row.id)}
                                    className="icon-action is-danger"
                                    title="Delete item"
                                  >
                                    <Trash2 size={15} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-action"
                                    title="Edit item"
                                  >
                                    <SquarePen size={15} strokeWidth={1.75} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}