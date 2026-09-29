import Image from "next/image";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../styles/login.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function LoginPage() {
  return (
    <main className={`${poppins.className} auth-page`}>

      {/* TOP NAVIGATION */}
      <header className="auth-navbar">

        {/* BRAND */}
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

        {/* NAVIGATION */}
        <nav className="flex items-center gap-7">
          <a
            href="/about-us"
            className="auth-nav-text"
          >
            About Us
          </a>

          <a
            href="/about-aims"
            className="auth-nav-text"
          >
            About AIMS
          </a>
        </nav>

      </header>

      {/* MAIN CONTENT */}
      <div className="auth-content">

        {/* LOGIN CONTENT */}
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

            <h1 className="auth-title mt-1">
              AIMS
            </h1>

          </div>

          {/* LOGIN HEADER */}
          <div className="mb-5 text-center">

            <h2 className="auth-heading">
              Login to your account
            </h2>

            <p className="auth-description">
              Please enter your details.
            </p>

          </div>

          {/* FIRST NAME */}
          <div className="mb-4">

            <label
              htmlFor="firstName"
              className="auth-label"
            >
              First name
            </label>

            <input
              id="firstName"
              type="text"
              placeholder="Enter your first name"
              className="auth-input"
            />

          </div>

          {/* PASSWORD */}
          <div className="mb-5">

            <label
              htmlFor="password"
              className="auth-label"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="auth-input"
            />

            {/* FORGOT PASSWORD */}
            <div className="mt-2 text-right">
              <a
                href="/forgot-password"
                className="auth-link text-[10px]"
              >
                Forgot password?
              </a>
            </div>

          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="auth-button"
          >
            Login account
          </button>

          {/* DIVIDER */}
          <div className="auth-divider">

            <div className="auth-divider-line" />

            <span className="auth-divider-text">
              or
            </span>

            <div className="auth-divider-line" />

          </div>

          {/* REGISTER TEXT */}
          <div className="auth-bottom-text">

            <p>
              Don't have an account?{" "}
              <a
                href="/register"
                className="auth-link"
              >
                Create an account
              </a>
            </p>

          </div>

        </section>
      </div>

    </main>
  );
}