import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

/**
 * Global site header (shared across pages)
 * - Brand + Nav brought up into a single tight band
 * - Reduced vertical padding
 * - Right-side actions inline (Login + Search)
 */
export default function Header() {
  const navigate = useNavigate();

  function onSubmitSearch(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = String(form.elements.q?.value || "").trim();
    if (q) navigate(`/shop?q=${encodeURIComponent(q)}`);
    else navigate("/shop");
  }

  return (
    <header style={styles.wrap}>
      <div style={styles.inner}>
        {/* LEFT — BRAND */}
        <Link to="/" style={styles.brand} aria-label="Home">
          Block Radius
        </Link>

        {/* CENTER — NAV */}
        <nav style={styles.centerNav} aria-label="Primary">
          <NavItem to="/">Home</NavItem>
          <NavItem to="/account">Account</NavItem>
          <NavItem to="/shop">Shop</NavItem>
        </nav>

        {/* RIGHT — ACTIONS */}
        <div style={styles.right}>
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={styles.loginBtn}
            aria-label="Login"
          >
            Login
          </button>

          <form
            onSubmit={onSubmitSearch}
            style={styles.searchForm}
            role="search"
            aria-label="Site search"
          >
            <input
              name="q"
              type="search"
              placeholder="Search"
              autoComplete="off"
              style={styles.searchInput}
            />
          </form>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={({ isActive }) => ({
        ...styles.navLink,
        opacity: isActive ? 1 : 0.7,
        borderBottomColor: isActive
          ? "rgba(255,255,255,0.45)"
          : "transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

const styles = {
  wrap: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  },

  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "10px 16px", // 🔽 reduced vertical padding
    display: "flex",
    alignItems: "center",
    gap: 24,
  },

  brand: {
    color: "inherit",
    textDecoration: "none",
    fontWeight: 700,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  },

  centerNav: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    justifyContent: "center",
    flex: "1 1 auto",
  },

  navLink: {
    color: "inherit",
    textDecoration: "none",
    fontSize: 14,
    padding: "4px 2px",
    borderBottom: "1px solid",
    transition: "opacity 120ms ease",
    whiteSpace: "nowrap",
  },

  right: {
    display: "flex",          // 🔄 was column
    alignItems: "center",
    gap: 12,
    flex: "0 0 auto",
  },

  searchForm: {
    width: 220,               // 🔽 reduced visual weight
  },

  searchInput: {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(160,120,255,0.35)",
    background: "rgba(40,20,80,0.35)",
    color: "inherit",
    outline: "none",
  },

  loginBtn: {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
