import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ApiDemo from './components/ApiDemo';
import './App.css';

// Main App component with routing
function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>⚡ Electricity Consumption App</h1>
          <p>Monitor your electricity usage with data from Eloverblik</p>
          <p>By Daniel Baker Kristensen</p>
        </header>

        <main className="App-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo" element={<ApiDemo />} />
          </Routes>
        </main>

        <footer className="App-footer">
          <nav>
            <Link to="/">Home</Link> | 
            <Link to="/demo">API Demo</Link>
          </nav>
          <p>© {new Date().getFullYear()} Electricity App</p>
        </footer>
      </div>
    </Router>
  );
}

// Home component for the main page
function Home() {
  return (
    <div className="home-container">
      <h2>Welcome to the Electricity Consumption App</h2>
      <p>Use the navigation above to explore the application.</p>
    </div>
  );
}

export default App;

