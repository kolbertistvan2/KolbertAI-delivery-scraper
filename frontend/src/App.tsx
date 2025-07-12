import React, { useState } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [websites, setWebsites] = useState('');
  const [status, setStatus] = useState<'idle'|'running'|'done'>('idle');
  const [results, setResults] = useState<Array<{domain: string, status: string, file: string}>>([]);

  const handleRun = () => {
    setStatus('running');
    setTimeout(() => {
      setStatus('done');
    }, 2000);
  };

  return (
    <div className="modern-container">
      <div className="main-content">
        <header>
          <img src="/kolbertai-logo.png" alt="Kolbert AI logo" style={{ height: 40, marginBottom: 8 }} />
          <h1 className="main-title">Kolbert AI Shipping Info Extractor</h1>
        </header>
        <div className="modern-editors">
          <div style={{ flex: 1 }}>
            <label className="modern-label">Prompt szerkesztése</label>
            <textarea
              className="modern-textarea"
              placeholder="Ide írd a promptot..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="modern-label">Websites szerkesztése</label>
            <textarea
              className="modern-textarea"
              placeholder={"domain1.hr\ndomain2.hr\n..."}
              value={websites}
              onChange={e => setWebsites(e.target.value)}
            />
          </div>
        </div>
        <button className="modern-btn" onClick={handleRun} disabled={status==='running'}>
          {status === 'running' ? 'Futtatás...' : 'Futtatás indítása'}
        </button>
        <div className="modern-status">
          {status === 'idle' && <span className="badge badge-idle">Várakozás...</span>}
          {status === 'running' && <span className="badge badge-running">Futtatás folyamatban...</span>}
          {status === 'done' && <span className="badge badge-done">Futtatás kész!</span>}
        </div>
        <section className="modern-results">
          <h2 className="modern-results-title">Eredmények</h2>
          <div className="modern-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Státusz</th>
                  <th>Letöltés</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{textAlign: 'center', color: '#888'}}>Nincs eredmény</td>
                  </tr>
                ) : (
                  results.map(r => (
                    <tr key={r.domain}>
                      <td>{r.domain}</td>
                      <td>
                        {r.status === 'success' ? (
                          <span className="status-success">
                            <span className="icon-success">✅</span> Sikeres
                          </span>
                        ) : (
                          <span className="status-error">
                            <span className="icon-error">❌</span> Hiba
                          </span>
                        )}
                      </td>
                      <td>
                        <a className="download-link" href={`#/${r.file}`} download>{r.file}</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <footer>
        <span className="footer-note">&copy; {new Date().getFullYear()} Kolbert AI</span>
      </footer>
    </div>
  );
}

export default App;
