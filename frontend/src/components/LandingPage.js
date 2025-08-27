import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1>⚡ Electricity Consumption Tracker</h1>
        <p className="tagline">Monitor and analyze your home's energy usage</p>
      </header>
      
      <main className="landing-content">
        <section className="features">
          <div className="feature-card">
            <h3>Real-time Monitoring</h3>
            <p>Track your electricity usage in real-time with data from Eloverblik</p>
          </div>
          <div className="feature-card">
            <h3>Detailed Analytics</h3>
            <p>Understand your consumption patterns with detailed analytics</p>
          </div>
          <div className="feature-card">
            <h3>Cost Tracking</h3>
            <p>Monitor your electricity costs and identify savings opportunities</p>
          </div>
        </section>
        
        <div className="cta-container">
          <Link to="/demo" className="cta-button">
            View Demo
          </Link>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
