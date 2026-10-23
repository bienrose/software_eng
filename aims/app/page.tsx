import { redirect } from "next/navigation";

export default function Home() {
  return (
    <main className="admin-shell">
      <section className="admin-landing">
        <p className="admin-eyebrow">Adaptive Inventory Management</p>
        <h1 className="admin-page-title">Inventory decisions, grounded in stock movement.</h1>
        <p className="admin-page-description">Track on-hand quantities, review demand signals, and prioritize replenishment from one operational workspace.</p>
        <a className="admin-button admin-button--primary" href="/dashboard">Open dashboard</a>
      </section>
    </main>
  );
}
