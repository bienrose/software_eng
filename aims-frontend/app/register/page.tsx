import Image from "next/image";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../styles/login.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function RegisterPage() {
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

        {/* REGISTER CONTENT */}
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

            <h1 className="auth-title mt-2">
              AIMS
            </h1>

          </div>

          {/* REGISTER HEADER */}
          <div className="mb-5 text-center">

            <h2 className="auth-heading">
              Create your account
            </h2>

            <p className="auth-description">
              Enter your details to get started.
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

          {/* LAST NAME */}
          <div className="mb-4">

            <label
              htmlFor="lastName"
              className="auth-label"
            >
              Last name
            </label>

            <input
              id="lastName"
              type="text"
              placeholder="Enter your last name"
              className="auth-input"
            />

          </div>

          {/* EMAIL */}
          <div className="mb-4">

            <label
              htmlFor="email"
              className="auth-label"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email address"
              className="auth-input"
            />

          </div>

          {/* PASSWORD */}
          <div className="mb-4">

            <label
              htmlFor="password"
              className="auth-label"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Create a password"
              className="auth-input"
            />

          </div>

          {/* CONFIRM PASSWORD */}
          <div className="mb-5">

            <label
              htmlFor="confirmPassword"
              className="auth-label"
            >
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              className="auth-input"
            />

          </div>

          {/* REGISTER BUTTON */}
          <button
            type="submit"
            className="auth-button"
          >
            Create account
          </button>

          {/* DIVIDER */}
          <div className="auth-divider">

            <div className="auth-divider-line" />

            <span className="auth-divider-text">
              or
            </span>

            <div className="auth-divider-line" />

          </div>

          {/* LOGIN TEXT */}
          <div className="auth-bottom-text">

            <p>
              Already have an account?{" "}
              <a
                href="/login"
                className="auth-link"
              >
                Login here
              </a>
            </p>

          </div>

        </section>
      </div>

    </main>
  );
}