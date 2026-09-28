import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/montserrat';
import './styles/global.css';
import './styles/components.css';
import { App } from './App';
import { initSync } from './lib/sync';

initSync();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
