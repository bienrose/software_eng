import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../styles/login.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function ForgotPasswordPage() {
  return (
    <main className={`${poppins.className} auth-page`}>
      {/* TOP NAVIGATION */}
      <header className="auth-navbar">
        <div className="flex items-center gap-2.5">
          <Image
            src={logo}
            alt="AIMS Logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <span className="auth-brand-title">
            AIMS - Adaptive Inventory Management System
          </span>
        </div>

        <nav className="flex items-center gap-7">
          <Link href="/about-us" className="auth-nav-text">
            About Us
          </Link>
          <Link href="/about-aims" className="auth-nav-text">
            About AIMS
          </Link>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <div className="auth-content">
        <section className="auth-section">
          {/* AIMS BRANDING */}
          <div className="mb-1 text-center">
            <Image
              src={logo}
              alt="AIMS Logo"
              width={54}
              height={54}
              className="mx-auto object-contain"
            />
            <h1 className="auth-title mt-2">AIMS</h1>
          </div>

          {/* HEADER */}
          <div className="mb-5 text-center">
            <h2 className="auth-heading">Forgot your password?</h2>
            <p className="auth-description">
              Enter your email address and we&apos;ll help you reset your password.
            </p>
          </div>

          {/* EMAIL */}
          <form>
            <div className="mb-5">
              <label htmlFor="email" className="auth-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email address"
                className="auth-input"
              />
            </div>

            {/* RESET BUTTON */}
            <button type="submit" className="auth-button">
              Send reset instructions
            </button>
          </form>

          {/* DIVIDER */}
          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
            <div className="auth-divider-line" />
          </div>

          {/* LOGIN */}
          <div className="rounded-md bg-[#e8f5e9] px-4 py-3 text-center shadow-[0_4px_12px_rgba(20,92,50,0.08)]">
            <p className="auth-bottom-text">
              Remember your password?{" "}
              <Link href="/login" className="auth-link">
                Login here
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}