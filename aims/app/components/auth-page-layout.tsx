import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import styles from "../styles/auth-page.module.css";

type AuthPageLayoutProps = {
  logo: string;
  title: string;
  description: string;
  eyebrow?: string;
  contentClassName?: string;
  children: ReactNode;
};

export default function AuthPageLayout({ logo, title, description, eyebrow = "AIMS ACCOUNT", contentClassName, children }: AuthPageLayoutProps) {
  return (
    <main className={`admin-auth-page ${styles.page}`}>
      <div className={styles.layout}>
        <section className={styles.brandPanel} aria-label="About AIMS">
          <Link href="/login" className={styles.brand} aria-label="AIMS home">
            <span className={styles.logoFrame}><Image src={logo} alt="" width={36} height={36} priority /></span>
            <span>
              <strong>AIMS</strong>
              <small>Adaptive Inventory Management</small>
            </span>
          </Link>

          <div className={styles.brandMessage}>
            <h1>Know what you have. Plan what comes next.</h1>
            <p>Keep stock, supplies, and inventory activity organized in one clear workspace.</p>
          </div>

          <p className={styles.brandFooter}>A clearer view of the supplies your team depends on.</p>
        </section>

        <section className={styles.formPanel} aria-labelledby="auth-heading">
          <div className={styles.mobileBrand}>
            <Image src={logo} alt="" width={30} height={30} priority />
            <strong>AIMS</strong>
          </div>

          <div className={`${styles.formContent} ${contentClassName ?? ""}`}>
            <span className={styles.welcome}>{eyebrow}</span>
            <h2 id="auth-heading">{title}</h2>
            <p className={styles.formIntro}>{description}</p>
            {children}
          </div>

          <div className={styles.securityNote}><ShieldCheck size={15} /><span>Your workspace is ready when you are.</span></div>
        </section>
      </div>
    </main>
  );
}
