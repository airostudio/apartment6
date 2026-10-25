'use client';

import { useEffect } from 'react';

// The pages were written as plain HTML + vanilla JS. This loads their scripts,
// in order, once React has hydrated the markup (so scripts that edit the DOM
// never race hydration). Scripts that wait for DOMContentLoaded / load would
// otherwise miss those events, so late listeners are fired immediately.
function installReadyShim() {
  if (window.__legacyReadyShim) return;
  window.__legacyReadyShim = true;

  const origDoc = document.addEventListener.bind(document);
  document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
      setTimeout(() => fn.call(document, new Event('DOMContentLoaded')), 0);
      return;
    }
    return origDoc(type, fn, opts);
  };

  const origWin = window.addEventListener.bind(window);
  window.addEventListener = function (type, fn, opts) {
    if (type === 'load' && document.readyState === 'complete') {
      setTimeout(() => fn.call(window, new Event('load')), 0);
      return;
    }
    return origWin(type, fn, opts);
  };
}

function loadSequentially(srcs) {
  return srcs.reduce(
    (chain, src) =>
      chain.then(
        () =>
          new Promise((resolve) => {
            const el = document.createElement('script');
            el.src = src;
            el.async = false;
            el.onload = resolve;
            el.onerror = () => {
              console.error('Failed to load script', src);
              resolve();
            };
            document.body.appendChild(el);
          })
      ),
    Promise.resolve()
  );
}

export default function LegacyScripts({ srcs }) {
  useEffect(() => {
    installReadyShim();
    loadSequentially(srcs);
  }, [srcs]);
  return null;
}
