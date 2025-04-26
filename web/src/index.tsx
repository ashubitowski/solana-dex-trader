import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WalletContextProvider } from './contexts/WalletContext';
import { configureAmplify } from './config/amplify';
import { Notifications } from './components/Notifications';
import './index.css';
import App from './App';

// Initialize Amplify with Cognito configuration
configureAmplify();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletContextProvider>
        <App />
        <Notifications />
      </WalletContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

