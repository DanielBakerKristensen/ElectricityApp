import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children }) => {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          <Link to="/" className="logo">
            ⚡ Electricity Tracker
          </Link>
          <nav className="main-nav">
            <Link to="/demo" className="nav-link">
              Demo
            </Link>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Electricity Tracker</p>
          <div className="footer-links">
            <Link to="/demo" className="footer-link">
              API Demo
            </Link>
            <a
              href="https://github.com/yourusername/electricity-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;