import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

/**
 * Global site header (shared across pages)
 * Requirements:
 * - Brand text: "Block Radius"
 * - Nav: Home, Shop, Account
 * - Search bar (persistent)
 * - Login button (top-right)
 * - NO avatar/user indicator
 * - NO expand/diagonal icon
 */
export default function Header() {
  const navigate = useNavigate();

  function onSubmitSearch(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = String(form.elements.q?.value || "").trim();
    // no backend: route to shop with query for now
    if (q) navigate(`/shop?q=${encodeURIComponent(q)}`);
    else navigate("/shop");
  }

  return (
    <header style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <Link to="/" style={styles.brand} aria-label="Home">
            Block Radius
          </Link>

          <nav style={styles.nav} aria-label="Primary">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/shop">Shop</NavItem>
            <NavItem to="/account">Account</NavItem>
          </nav>
        </div>

        <div style={styles.right}>
          <form onSubmit={onSubmitSearch} style={styles.searchForm} role="search" aria-label="Site search">
            <input
              name="q"
              type="search"
              placeholder="Search"
              autoComplete="off"
              style={styles.searchInput}
            />
          </form>

          <button
            type="button"
            onClick={() => navigate("/login")}
            style={styles.loginBtn}
            aria-label="Login"
          >
            Login
          </button>
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
        opacity: isActive ? 1 : 0.75,
        borderBottomColor: isActive ? "rgba(255,255,255,0.45)" : "transparent",
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
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    minWidth: 0,
  },
  brand: {
    color: "inherit",
    textDecoration: "none",
    fontWeight: 700,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  navLink: {
    color: "inherit",
    textDecoration: "none",
    fontSize: 14,
    padding: "6px 2px",
    borderBottom: "1px solid",
    transition: "opacity 120ms ease",
    whiteSpace: "nowrap",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  searchForm: { minWidth: 240, maxWidth: 360, width: "32vw" },
  searchInput: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    outline: "none",
  },
  loginBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
