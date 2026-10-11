import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardPage from './page';
import './globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <DashboardPage />
    </React.StrictMode>
  );
}
