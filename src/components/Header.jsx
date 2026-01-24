import { NavLink } from 'react-router-dom';

export default function Header() {
    return (
        <header className="header">
            <NavLink to="/" className="header-logo">
                Block Radius
            </NavLink>

            <nav className="header-nav">
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                    Home
                </NavLink>
                <NavLink to="/shop" className={({ isActive }) => isActive ? 'active' : ''}>
                    Shop
                </NavLink>
                <NavLink to="/account" className={({ isActive }) => isActive ? 'active' : ''}>
                    Account
                </NavLink>
            </nav>

            <NavLink to="/account" className="header-login">
                Login
            </NavLink>
        </header>
    );
}
