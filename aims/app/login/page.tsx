import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AuthPageLayout from "../components/auth-page-layout";
import styles from "../styles/auth-page.module.css";

export default function LoginPage() {
  return (
    <AuthPageLayout
      logo="/aims-logo.png"
      title="Sign in to your account"
      description="Enter your details to access your inventory workspace."
      eyebrow="WELCOME BACK"
    >
      <div className={styles.fields}>
        <label className={styles.field} htmlFor="firstName">
          <span>First name</span>
          <input id="firstName" name="firstName" type="text" autoComplete="given-name" placeholder="Enter your first name" />
        </label>
        <label className={styles.field} htmlFor="password">
          <span>Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" />
        </label>
      </div>

      <div className={styles.forgotRow}>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>

      <button type="submit" className={styles.submitButton}>
        Sign in <ArrowRight size={16} />
      </button>

      <div className={styles.signup}>
        <span>New to AIMS?</span> <Link href="/register">Create an account</Link>
      </div>
    </AuthPageLayout>
  );
}
