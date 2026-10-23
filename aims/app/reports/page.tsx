"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { AdminShell } from "../components/admin-shell";

type Row = { id: string; name: string; categoryName: string; quantity: number; reorderLevel: number; unit: string };
type Report = { categories: { id: string; name: string }[]; stockLevels: Row[]; movements: { id: string; itemName: string; type: string; quantity: number; occurredAt: string }[]; topUsed: { id: string; name: string; quantity: number }[]; categorySummary: { id: string; name: string; stock: number }[]; predictedVsActual: { id: string; itemName: string; demandLevel: string; predictionFor: string; actualQuantity: number }[]; error?: string };

const formatNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const defaultStartDate = () => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (categoryId) params.set("categoryId", categoryId);
      const response = await fetch(`/api/reports?${params}`, { cache: "no-store" });
      const result = await response.json() as Report;
      if (!response.ok) throw new Error(result.error || "Could not load inventory reports.");
      setReport(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load inventory reports.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, dateFrom, dateTo]);
  useEffect(() => { void load(); }, [load]);
  const stock = report?.stockLevels ?? [];
  const lowStock = stock.filter((item) => item.quantity <= item.reorderLevel);
  const totalStock = stock.reduce((total, item) => total + item.quantity, 0);
  const maxUsed = Math.max(...(report?.topUsed.map((item) => item.quantity) ?? [1]), 1);
  const exportCsv = () => {
    const rows = [["Item", "Category", "On hand", "Reorder point", "Unit"], ...stock.map((item) => [item.name, item.categoryName, item.quantity, item.reorderLevel, item.unit])];
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `aims-inventory-report-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <AdminShell activePath="/reports" title="Inventory reports"><div className="admin-content"><div className="admin-page-heading"><div><p className="admin-eyebrow">Reporting</p><h2 className="admin-page-title">Inventory performance</h2><p className="admin-page-description">Review stock levels, movement activity, category distribution, and demand prediction outcomes for the selected period.</p></div></div><div className="admin-toolbar"><input className="admin-field" type="date" aria-label="Start date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><input className="admin-field" type="date" aria-label="End date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><select className="admin-field" aria-label="Inventory category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{report?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button className="admin-button admin-button--primary" type="button" onClick={() => void load()}><RefreshCw />Refresh</button><button className="admin-button" type="button" onClick={exportCsv} disabled={!report}><Download />Export CSV</button><button className="admin-button" type="button" onClick={() => window.print()}><Printer />Save PDF</button></div>{error && <div className="admin-alert" role="alert">{error}</div>}{loading ? <div className="admin-state">Loading inventory reports…</div> : <><section className="admin-metrics" aria-label="Report summary"><article className="admin-metric"><div className="admin-metric-label">Current stock</div><div className="admin-metric-value">{formatNumber.format(totalStock)}</div></article><article className="admin-metric"><div className="admin-metric-label">Low stock</div><div className="admin-metric-value">{formatNumber.format(lowStock.length)}</div></article><article className="admin-metric"><div className="admin-metric-label">Movement records</div><div className="admin-metric-value">{formatNumber.format(report?.movements.length ?? 0)}</div></article><article className="admin-metric"><div className="admin-metric-label">Demand predictions</div><div className="admin-metric-value">{formatNumber.format(report?.predictedVsActual.length ?? 0)}</div></article></section><section className="admin-grid"><article className="admin-panel"><div className="admin-panel-header"><h3 className="admin-panel-title">Top-used items</h3></div><div className="admin-panel-body"><div className="admin-bar-list">{report?.topUsed.map((item) => <div className="admin-bar-row" key={item.id}><span>{item.name}</span><span className="admin-bar-track"><span className="admin-bar-fill" style={{ "--bar-value": `${item.quantity / maxUsed * 100}%` } as CSSProperties} /></span><strong className="admin-number">{formatNumber.format(item.quantity)}</strong></div>)}</div></div></article><article className="admin-panel"><div className="admin-panel-header"><h3 className="admin-panel-title">Category stock share</h3></div><div className="admin-panel-body"><div className="admin-pie"><span className="admin-pie-center">{report?.categorySummary.length ?? 0}<br />categories</span></div></div></article></section><section className="admin-panel"><div className="admin-panel-header"><h3 className="admin-panel-title">Current stock levels</h3><span>{stock.length} items</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Category</th><th className="admin-number">On hand</th><th className="admin-number">Reorder point</th><th>Status</th></tr></thead><tbody>{stock.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.categoryName}</td><td className="admin-number">{formatNumber.format(item.quantity)} {item.unit}</td><td className="admin-number">{formatNumber.format(item.reorderLevel)}</td><td><span className={`admin-badge ${item.quantity <= item.reorderLevel ? "admin-badge--warning" : "admin-badge--success"}`}>{item.quantity <= item.reorderLevel ? "Low stock" : "Healthy"}</span></td></tr>)}</tbody></table></div></section><section className="admin-panel"><div className="admin-panel-header"><h3 className="admin-panel-title">Stock movement history</h3></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Recorded</th><th>Item</th><th>Movement</th><th className="admin-number">Quantity</th></tr></thead><tbody>{report?.movements.map((item) => <tr key={item.id}><td>{new Date(item.occurredAt).toLocaleDateString()}</td><td>{item.itemName}</td><td>{item.type === "stock_in" ? "Stock in" : "Stock out"}</td><td className="admin-number">{formatNumber.format(item.quantity)}</td></tr>)}</tbody></table></div></section><section className="admin-panel"><div className="admin-panel-header"><h3 className="admin-panel-title">Predicted versus actual demand</h3></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Prediction date</th><th>Predicted demand</th><th className="admin-number">Actual stock-out</th></tr></thead><tbody>{report?.predictedVsActual.map((item) => <tr key={item.id}><td>{item.itemName}</td><td>{item.predictionFor}</td><td>{item.demandLevel === "moderate" ? "Medium" : item.demandLevel}</td><td className="admin-number">{formatNumber.format(item.actualQuantity)}</td></tr>)}</tbody></table></div></section></>}</div></AdminShell>;
}
