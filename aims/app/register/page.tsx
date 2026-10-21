import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AuthPageLayout from "../components/auth-page-layout";
import styles from "../styles/auth-page.module.css";

export default function RegisterPage() {
  return (
    <AuthPageLayout
      logo="/aims-logo.png"
      title="Create your account"
      description="Enter your details to get started with AIMS."
      eyebrow="GET STARTED"
      contentClassName={styles.registerContent}
    >
      <div className={styles.fields}>
        <label className={styles.field} htmlFor="firstName">
          <span>First name</span>
          <input id="firstName" name="firstName" type="text" autoComplete="given-name" placeholder="Enter your first name" />
        </label>
        <label className={styles.field} htmlFor="lastName">
          <span>Last name</span>
          <input id="lastName" name="lastName" type="text" autoComplete="family-name" placeholder="Enter your last name" />
        </label>
        <label className={styles.field} htmlFor="email">
          <span>Email address</span>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="Enter your email address" />
        </label>
        <label className={styles.field} htmlFor="password">
          <span>Password</span>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" />
        </label>
        <label className={styles.field} htmlFor="confirmPassword">
          <span>Confirm password</span>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm your password" />
        </label>
      </div>

      <button type="submit" className={styles.submitButton}>
        Create account <ArrowRight size={16} />
      </button>

      <div className={styles.signup}>
        <span>Already have an account?</span> <Link href="/login">Sign in</Link>
      </div>
    </AuthPageLayout>
  );
}
