import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from '@/components/AdminApp';
import WorkerApp from '@/components/WorkerApp';
import { ready, status } from './store';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function PrototypeBar({ worker }) {
  const [mode, setMode] = useState(status.mode);
  useEffect(() => { ready.then(() => setMode(status.mode)); }, []);
  return (
    <div className="proto">
      <b>Prototip</b>
      {worker
        ? <> · pogled osebe · <a href="#">← nazaj na pogled klinike</a></>
        : <> · pogled klinike · pogled osebe odprete v zavihku Ljudje → Odpri</>}
      {mode === 'local' && <div>Podatki se shranjujejo samo v tem brskalniku.</div>}
    </div>
  );
}

function Root() {
  const hash = useHash();
  const m = hash.match(/^#w-([A-Za-z0-9]+)$/);
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);
  return m ? (
    <>
      <PrototypeBar worker />
      <WorkerApp key={m[1]} token={m[1]} />
    </>
  ) : (
    <>
      <PrototypeBar />
      <AdminApp />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
