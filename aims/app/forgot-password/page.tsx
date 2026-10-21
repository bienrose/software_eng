import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AuthPageLayout from "../components/auth-page-layout";
import styles from "../styles/auth-page.module.css";

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      logo="/aims-logo.png"
      title="Reset your password"
      description="Enter the email address associated with your account and we’ll help you get back in."
      eyebrow="ACCOUNT RECOVERY"
    >
      <form>
        <div className={styles.fields}>
          <label className={styles.field} htmlFor="email">
            <span>Email address</span>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="Enter your email address" />
          </label>
        </div>

        <button type="submit" className={styles.submitButton}>
          Send reset instructions <ArrowRight size={16} />
        </button>
      </form>

      <div className={styles.signup}>
        <span>Remember your password?</span> <Link href="/login">Sign in</Link>
      </div>
    </AuthPageLayout>
  );
}
