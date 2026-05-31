import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, AlertTriangle, Trash2, Download, RotateCcw,
  Search, DoorOpen, Hash, ChevronRight, RotateCw,
  Upload, CheckCircle, FileText,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // user fills in
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // user fills in
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// WAREHOUSE INVENTORY MAP — v4.0
// • Supabase auth + per-user inventory isolation
// • User onboarding (profile setup)
// • All v3.7 functionality preserved
// ============================================================

const MAX_HISTORY = 50;
const APP_VERSION = '4.0';
const GRID_ROWS = 16;
const GRID_COLS = 16;

const WEST_DOOR = { row: 0, cols: [7, 8] };
const EAST_DOOR = { row: GRID_ROWS - 1, cols: [7, 8] };

const isDoorCell = (row, col) => {
  if (row === WEST_DOOR.row && WEST_DOOR.cols.includes(col)) return 'west';
  if (row === EAST_DOOR.row && EAST_DOOR.cols.includes(col)) return 'east';
  return null;
};

const cellId = (row, col) =>
  `R${String(row + 1).padStart(2, '0')}C${String(col + 1).padStart(2, '0')}`;

const DEFAULT_PALLET = {
  number: 0, row: 0, col: 0, stack_label: 'A',
  lot: '', blend: '', quantity: 0, units: 'bags',
  stack_height: 1, status: 'active', tag: '', notes: '',
};

const COMMON_BLENDS = [
  'Milk Replacer',
  'Magnum Milk Replacer',
  'Bucket Products',
];

const BUCKET_PRODUCTS = [
  'Eliminator',
  'First Aid',
  'Gold Medal',
  'HPVM',
  'Immunizer',
  'Magnum Calf Aide',
  'Magnum-Lac',
  'RFA',
  'RFA-5',
  'Top Calf',
];

const BUCKET_WEIGHTS = ['10#', '25#', '50#'];
const IMMUNIZER_WEIGHTS = ['10#', '25#', '44#', '50#'];

const validatePallet = (p) => ({
  id: p.id || `p_${Date.now()}_${Math.random()}`,
  number: Number(p.number) || 0,
  row: Math.max(0, Math.min(GRID_ROWS - 1, Number(p.row) || 0)),
  col: Math.max(0, Math.min(GRID_COLS - 1, Number(p.col) || 0)),
  stack_label: ['A', 'B', 'C'].includes(p.stack_label) ? p.stack_label : 'A',
  lot: String(p.lot || ''),
  blend: String(p.blend || ''),
  quantity: Math.max(0, Number(p.quantity) || 0),
  units: p.units || 'bags',
  stack_height: Math.max(1, Math.min(3, Number(p.stack_height) || 1)),
  status: ['active', 'old_bad'].includes(p.status) ? p.status : 'active',
  tag: String(p.tag || ''),
  notes: String(p.notes || ''),
});

// ── Loading screen ─────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading...</div>
    </div>
  );
}

// ── Auth screen ────────────────────────────────────────────────────
function AuthScreen() {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg('Account created! Check your email to confirm, then sign in.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-teal-400">WAREHOUSE INVENTORY</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to manage your pallets</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
          <div className="flex rounded-lg overflow-hidden mb-5 bg-slate-800">
            <button
              type="button"
              onClick={() => { setTab('signin'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${tab === 'signin' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Sign In</button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${tab === 'signup' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Create Account</button>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 px-3 py-2 bg-green-900/40 border border-green-700/50 rounded-lg text-green-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-slate-800 text-slate-100 rounded px-3 py-2.5 border border-slate-700 focus:border-teal-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-800 text-slate-100 rounded px-3 py-2.5 border border-slate-700 focus:border-teal-500 focus:outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition ${loading ? 'bg-teal-800 text-teal-300 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-400 text-slate-950'}`}
            >
              {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Onboarding screen ──────────────────────────────────────────────
function OnboardingScreen({ user, onComplete }) {
  const [formName, setFormName] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formWarehouseName.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.from('profiles').upsert({
      id: user.id,
      name: formName.trim(),
      warehouse_name: formWarehouseName.trim(),
      onboarding_complete: true,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      onComplete({
        id: user.id,
        name: formName.trim(),
        warehouse_name: formWarehouseName.trim(),
        onboarding_complete: true,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-teal-400">WAREHOUSE INVENTORY</h1>
          <p className="text-slate-500 text-sm mt-1">Set up your profile to get started</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Welcome! Tell us about yourself</h2>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold block mb-1">Your Full Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
                placeholder="e.g. Jane Smith"
                className="w-full bg-slate-800 text-slate-100 rounded px-3 py-2.5 border border-slate-700 focus:border-teal-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold block mb-1">Warehouse Name</label>
              <input
                type="text"
                value={formWarehouseName}
                onChange={e => setFormWarehouseName(e.target.value)}
                required
                placeholder="e.g. Distribution Center A"
                className="w-full bg-slate-800 text-slate-100 rounded px-3 py-2.5 border border-slate-700 focus:border-teal-500 focus:outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition ${loading ? 'bg-teal-800 text-teal-300 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-400 text-slate-950'}`}
            >
              {loading ? 'Saving…' : 'Get Started'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Root App component ─────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  }

  if (authLoading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  if (!profile?.onboarding_complete) return <OnboardingScreen user={user} onComplete={setProfile} />;
  return <WarehouseMap user={user} profile={profile} onSignOut={async () => { await supabase.auth.signOut(); }} />;
}

// ── Inline confirm dialog ──────────────────────────────────────────
function ConfirmDialog({ state, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 max-w-sm w-full shadow-2xl">
        <p className="text-sm text-slate-200 whitespace-pre-line mb-5 leading-relaxed">{state.message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition font-medium"
          >Cancel</button>
          <button onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition"
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Main WarehouseMap component ────────────────────────────────────
function WarehouseMap({ user, profile, onSignOut }) {
  const [pallets, setPallets] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [editingPalletId, setEditingPalletId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const fileInputRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  // Load from Supabase
  useEffect(() => {
    supabase.from('pallets').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        setPallets(data ? data.map(validatePallet) : []);
        setLoading(false);
      });
  }, [user.id]);

  // Debounced Supabase sync
  useEffect(() => {
    if (loading) return;
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      await supabase.from('pallets').delete().eq('user_id', user.id);
      if (pallets.length > 0) {
        await supabase.from('pallets').insert(pallets.map(p => ({ ...p, user_id: user.id })));
      }
    }, 800);
    return () => clearTimeout(syncTimeoutRef.current);
  }, [pallets, loading]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const showFeedback = useCallback((type, message) =>
    setFeedback({ type, message }), []);

  // Confirm helpers
  const requestConfirm = useCallback((message, onConfirm) =>
    setConfirmState({ message, onConfirm }), []);
  const handleConfirmAccept = useCallback(() => {
    if (confirmState) { confirmState.onConfirm(); setConfirmState(null); }
  }, [confirmState]);
  const handleConfirmCancel = useCallback(() => setConfirmState(null), []);

  // Helpers
  const getPalletsInCell = useCallback(
    (row, col) =>
      pallets
        .filter(p => p.row === row && p.col === col)
        .sort((a, b) =>
          ({ A: 0, B: 1, C: 2 }[a.stack_label] || 0) -
          ({ A: 0, B: 1, C: 2 }[b.stack_label] || 0)
        ),
    [pallets],
  );

  const getDisplayLabel = useCallback(
    (pallet, cellPallets) =>
      cellPallets.length > 1
        ? `${pallet.number}${pallet.stack_label}`
        : `${pallet.number}`,
    [],
  );

  // ── Mutations ──────────────────────────────────────────────────────
  const deleteCell = useCallback((row, col) => {
    const inCell = pallets.filter(p => p.row === row && p.col === col);
    if (!inCell.length) { showFeedback('error', 'Cell is already empty'); return; }
    const list = inCell.map(p => `#${p.number}${inCell.length > 1 ? p.stack_label : ''}`).join(', ');
    const snap = pallets;
    requestConfirm(
      `Delete all ${inCell.length} pallet(s) from this cell?\n\nRemoving: ${list}\n\nThis can be undone.`,
      () => {
        setHistory(h => [...h, snap].slice(-MAX_HISTORY));
        setPallets(prev => prev.filter(p => !(p.row === row && p.col === col)));
        setSelectedCellId(null); setEditingPalletId(null);
        showFeedback('success', `✓ Deleted ${inCell.length} pallet(s) from cell`);
      },
    );
  }, [pallets, showFeedback, requestConfirm]);

  const deletePallet = useCallback((id) => {
    const p = pallets.find(x => x.id === id);
    if (!p) { showFeedback('error', '✗ Pallet not found'); return; }
    const cell = pallets.filter(x => x.row === p.row && x.col === p.col);
    const lbl = cell.length > 1 ? `${p.number}${p.stack_label}` : `${p.number}`;
    const snap = pallets;
    requestConfirm(`Delete Pallet #${lbl}?`, () => {
      setHistory(h => [...h, snap].slice(-MAX_HISTORY));
      setPallets(prev => prev.filter(x => x.id !== id));
      if (cell.length === 1) setSelectedCellId(null);
      setEditingPalletId(null);
      showFeedback('success', `✓ Deleted Pallet #${lbl}`);
    });
  }, [pallets, showFeedback, requestConfirm]);

  const updatePallet = useCallback((id, updates) => {
    setHistory(h => [...h, pallets].slice(-MAX_HISTORY));
    setPallets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    showFeedback('success', '✓ Pallet updated');
  }, [pallets, showFeedback]);

  const addPalletToCell = useCallback((row, col) => {
    const here = pallets.filter(p => p.row === row && p.col === col);
    if (here.length >= 3) { showFeedback('error', 'Cell is full (max 3 pallets)'); return; }
    const taken = new Set(here.map(p => p.stack_label));
    const nextLabel = !taken.has('A') ? 'A' : !taken.has('B') ? 'B' : 'C';
    const nextNum = pallets.reduce((m, p) => Math.max(m, Number(p.number) || 0), 0) + 1;
    const newPallet = { ...DEFAULT_PALLET, id: `p_${Date.now()}_${Math.random()}`, number: nextNum, row, col, stack_label: nextLabel };
    setHistory(h => [...h, pallets].slice(-MAX_HISTORY));
    setPallets(prev => [...prev, newPallet]);
    setSelectedCellId({ row, col });
    setEditingPalletId(newPallet.id);
    setAddMode(false);
    showFeedback('success', `✓ Added Pallet #${here.length + 1 > 1 ? `${nextNum}${nextLabel}` : nextNum}`);
  }, [pallets, showFeedback]);

  const undo = useCallback(() => {
    if (!history.length) { showFeedback('error', 'Nothing to undo'); return; }
    setHistory(prev => {
      const next = [...prev];
      setPallets(next.pop());
      return next;
    });
    setSelectedCellId(null); setEditingPalletId(null);
    showFeedback('success', '✓ Undone');
  }, [history, showFeedback]);

  const renumber = useCallback(() => {
    if (!pallets.length) { showFeedback('error', 'No pallets to renumber'); return; }
    const snap = pallets;
    requestConfirm('Renumber all pallets in reading order (top-down, left-right)?', () => {
      setHistory(h => [...h, snap].slice(-MAX_HISTORY));
      setPallets(prev => {
        const s = [...prev].sort((a, b) =>
          a.row !== b.row ? a.row - b.row : a.col !== b.col ? a.col - b.col : a.stack_label.localeCompare(b.stack_label)
        );
        return s.map((p, i) => ({ ...p, number: i + 1 }));
      });
      showFeedback('success', `✓ Renumbered ${snap.length} pallets`);
    });
  }, [pallets, showFeedback, requestConfirm]);

  const clearAll = useCallback(() => {
    if (!pallets.length) { showFeedback('error', 'Warehouse is already empty'); return; }
    const snap = pallets;
    requestConfirm(
      `Clear all ${pallets.length} pallets?\n\nThis can be undone with the Undo button.`,
      () => {
        setHistory(h => [...h, snap].slice(-MAX_HISTORY));
        setPallets([]); setSelectedCellId(null); setEditingPalletId(null);
        showFeedback('success', '✓ Cleared all pallets');
      },
    );
  }, [pallets, showFeedback, requestConfirm]);

  // ── Exports ────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!pallets.length) { showFeedback('error', 'No pallets to export'); return; }
    try {
      const headers = [
        'Cell ID', 'Pallet #', 'Stack Label',
        'Product / Blend', 'Lot #', 'Qty', 'Units',
        'Stack Height', 'Status', 'Tag', 'Notes',
        'Row (1-based)', 'Col (1-based)',
      ];
      const rows = [...pallets]
        .sort((a, b) =>
          a.row !== b.row ? a.row - b.row : a.col !== b.col ? a.col - b.col : a.stack_label.localeCompare(b.stack_label)
        )
        .map(p => {
          const cell = pallets.filter(x => x.row === p.row && x.col === p.col);
          return [
            cellId(p.row, p.col),
            getDisplayLabel(p, cell),
            p.stack_label,
            p.blend,
            p.lot,
            p.quantity,
            p.units,
            p.stack_height,
            p.status === 'old_bad' ? 'OLD/BAD' : 'Active',
            p.tag,
            p.notes,
            p.row + 1,
            p.col + 1,
          ];
        });

      const csv = [headers, ...rows]
        .map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warehouse_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('success', `✓ Exported ${pallets.length} pallets to CSV`);
    } catch (err) {
      console.error(err);
      showFeedback('error', '✗ CSV export failed');
    }
  }, [pallets, getDisplayLabel, showFeedback]);

  const exportJSON = useCallback(() => {
    if (!pallets.length) { showFeedback('error', 'No pallets to export'); return; }
    try {
      const data = { version: APP_VERSION, exportDate: new Date().toISOString(), gridRows: GRID_ROWS, gridCols: GRID_COLS, pallets };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warehouse_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('success', `✓ Exported ${pallets.length} pallets to JSON`);
    } catch { showFeedback('error', '✗ JSON export failed'); }
  }, [pallets, showFeedback]);

  const exportPDF = useCallback(() => {
    showFeedback('error', 'PDF export requires jsPDF library (available in full build)');
  }, [showFeedback]);

  const importJSON = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result;
        if (typeof raw !== 'string') throw new Error('Read failed');
        const data = JSON.parse(raw);
        if (!data.version) throw new Error('Missing version field');
        if (!Array.isArray(data.pallets)) throw new Error('pallets must be an array');
        const validated = data.pallets.map(validatePallet);
        if (!validated.length) { showFeedback('error', '✗ No valid pallets found'); return; }
        setHistory(h => [...h, pallets].slice(-MAX_HISTORY));
        setPallets(validated);
        setSelectedCellId(null); setEditingPalletId(null);
        showFeedback('success', `✓ Imported ${validated.length} pallets`);
      } catch (err) {
        showFeedback('error', `✗ Import failed: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      showFeedback('error', '✗ Failed to read file');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }, [pallets, showFeedback]);

  const handleCellClick = useCallback((row, col) => {
    if (isDoorCell(row, col)) return;
    const here = getPalletsInCell(row, col);
    if (addMode) {
      here.length < 3 ? addPalletToCell(row, col) : showFeedback('error', 'Cell is full (max 3 pallets)');
    } else {
      setSelectedCellId({ row, col });
      setEditingPalletId(here[0]?.id || null);
    }
  }, [addMode, getPalletsInCell, addPalletToCell, showFeedback]);

  const stats = useMemo(() => {
    const active = pallets.filter(p => p.status === 'active');
    const old = pallets.filter(p => p.status === 'old_bad');
    const totalBags = active.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const byBlend = {};
    active.forEach(p => { if (p.blend) byBlend[p.blend] = (byBlend[p.blend] || 0) + (Number(p.quantity) || 0); });
    return { active: active.length, old: old.length, total: pallets.length, totalBags, byBlend };
  }, [pallets]);

  const palletsInSelectedCell = selectedCellId ? getPalletsInCell(selectedCellId.row, selectedCellId.col) : [];
  const selectedPallet = editingPalletId ? pallets.find(p => p.id === editingPalletId) : null;

  const visiblePallets = useMemo(
    () => pallets.filter(p => {
      if (filter === 'active' && p.status !== 'active') return false;
      if (filter === 'old_bad' && p.status !== 'old_bad') return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return String(p.number).includes(s) || p.lot.toLowerCase().includes(s) ||
          p.blend.toLowerCase().includes(s) || p.notes.toLowerCase().includes(s) || p.tag.toLowerCase().includes(s);
      }
      return true;
    }),
    [pallets, filter, searchTerm],
  );

  const isHighlighted = useCallback(
    (id) => (!searchTerm && filter === 'all') || visiblePallets.some(p => p.id === id),
    [searchTerm, filter, visiblePallets],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-slate-400">Loading warehouse...</div>
      </div>
    );
  }

  const hasData = pallets.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>

      {confirmState && (
        <ConfirmDialog state={confirmState} onConfirm={handleConfirmAccept} onCancel={handleConfirmCancel} />
      )}

      {/* HEADER */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="px-3 py-2.5 md:py-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-base md:text-lg font-bold tracking-tight text-teal-400">WAREHOUSE INVENTORY</h1>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {profile.warehouse_name}
                {' · '}
                {!hasData ? 'Empty warehouse — tap Add Pallet to start' : `${pallets.length} pallets tracked`}
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap items-center">
              <button onClick={undo} disabled={!history.length}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!history.length ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-amber-700 text-amber-50 hover:bg-amber-600'
                  }`} title={`Undo (${history.length} available)`}
              >
                <RotateCw className="inline w-3 h-3 mr-0.5" />Undo
              </button>

              <button onClick={() => setAddMode(m => !m)}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${addMode ? 'bg-teal-500 text-slate-950 ring-2 ring-teal-400' : 'bg-teal-700 text-teal-50 hover:bg-teal-600'
                  }`}
              >
                <Plus className="inline w-3 h-3 mr-0.5" />{addMode ? 'Tap a cell…' : 'Add Pallet'}
              </button>

              <button onClick={renumber} disabled={!hasData}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!hasData ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`} title="Renumber pallets by position"
              >
                <Hash className="inline w-3 h-3" />
              </button>

              <span className="w-px bg-slate-700 self-stretch" />

              <button onClick={exportCSV} disabled={!hasData}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!hasData ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-emerald-700 text-emerald-50 hover:bg-emerald-600'
                  }`} title="Export spreadsheet (CSV with Cell IDs)"
              >
                <Download className="inline w-3 h-3 mr-0.5" />CSV
              </button>

              <button onClick={exportPDF} disabled={!hasData}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!hasData ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-rose-700 text-rose-50 hover:bg-rose-600'
                  }`} title="Export PDF report (requires full build)"
              >
                <FileText className="inline w-3 h-3 mr-0.5" />PDF
              </button>

              <button onClick={exportJSON} disabled={!hasData}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!hasData ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`} title="Export backup (JSON)"
              >
                <Download className="inline w-3 h-3 mr-0.5" />JSON
              </button>

              <button onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-[11px] rounded bg-blue-700 text-blue-50 hover:bg-blue-600 transition font-semibold"
                title="Restore from JSON backup"
              >
                <Upload className="inline w-3 h-3 mr-0.5" />Import
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />

              <button onClick={clearAll} disabled={!hasData}
                className={`px-2 py-1 text-[11px] rounded font-semibold transition ${!hasData ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-red-400'
                  }`} title="Clear all pallets"
              >
                <RotateCcw className="inline w-3 h-3" />
              </button>

              <span className="w-px bg-slate-700 self-stretch" />

              <button onClick={onSignOut}
                className="px-2 py-1 text-[11px] rounded font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100 transition"
                title="Sign out"
              >
                Sign Out
              </button>
            </div>
          </div>

          {feedback && (
            <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${feedback.type === 'success'
                ? 'bg-green-900/40 text-green-300 border border-green-700/50'
                : 'bg-red-900/40 text-red-300 border border-red-700/50'
              }`}>
              {feedback.type === 'success'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <StatChip label="Pallets" value={stats.total} color="slate" />
            <StatChip label="Active" value={stats.active} color="teal" />
            <StatChip label="Old/Bad" value={stats.old} color="red" />
            <StatChip label="Bags" value={stats.totalBags.toLocaleString()} color="amber" />
          </div>

          <div className="flex gap-1.5 mt-2">
            <div className="flex-1 relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search # / lot / blend / tag" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 rounded pl-6 pr-2 py-1 text-[11px] border border-slate-700 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-slate-800 text-slate-100 rounded px-2 py-1 text-[11px] border border-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="old_bad">Old/Bad</option>
            </select>
          </div>
        </div>
      </div>

      {/* GRID + PANEL */}
      <div className="flex flex-col lg:flex-row gap-3 p-2 md:p-3">
        {/* GRID */}
        <div className="flex-1 min-w-0">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 md:p-3 overflow-x-auto">
            <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold">
              <span className="text-slate-500">SOUTH ←</span>
              <span className="text-teal-400 uppercase tracking-wide">↑ WEST</span>
              <span className="text-slate-500">→ NORTH</span>
            </div>
            <div className="grid gap-0.5 md:gap-1 mx-auto"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(28px, 1fr))`, maxWidth: 900 }}
            >
              {Array.from({ length: GRID_ROWS }).map((_, row) =>
                Array.from({ length: GRID_COLS }).map((_, col) => {
                  const door = isDoorCell(row, col);
                  if (door) return <DoorCell key={`${row}-${col}`} side={door} />;
                  const here = getPalletsInCell(row, col);
                  const sel = !!(selectedCellId && selectedCellId.row === row && selectedCellId.col === col);
                  return (
                    <GridCell key={`${row}-${col}`} palletsInCell={here} row={row} col={col}
                      isSelected={sel} addMode={addMode}
                      highlighted={here.every(p => isHighlighted(p.id)) || !here.length}
                      onClick={() => handleCellClick(row, col)}
                      getDisplayLabel={getDisplayLabel}
                    />
                  );
                }),
              )}
            </div>
            <div className="flex items-center justify-center mt-1.5 text-[10px] font-semibold">
              <span className="text-teal-400 uppercase tracking-wide">↓ EAST</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <LegendItem color="bg-teal-600 border-teal-400" label="Active" />
            <LegendItem color="bg-red-700 border-red-400" label="Old / Bad" />
            <LegendItem color="bg-slate-800 border-slate-700 border-dashed" label="Empty" />
            <LegendItem color="bg-amber-500/30 border-amber-500/60 border-dashed" label="Doorway" />
          </div>
        </div>

        {/* EDIT PANEL */}
        {selectedCellId && (
          <div className="w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-lg p-3 h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {cellId(selectedCellId.row, selectedCellId.col)}
              </span>
              <span className="text-[10px] text-slate-500">
                Row {selectedCellId.row + 1}, Col {selectedCellId.col + 1}
              </span>
            </div>

            {!palletsInSelectedCell.length ? (
              <div className="text-slate-500 text-sm py-4">
                <p className="mb-3">No pallets in this cell</p>
                <button type="button" onClick={() => addPalletToCell(selectedCellId.row, selectedCellId.col)}
                  className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold rounded text-xs transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />Add Pallet Here
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                  {palletsInSelectedCell.map(p => (
                    <button key={p.id} type="button" onClick={() => setEditingPalletId(p.id)}
                      className={`w-full text-left px-2 py-2 rounded text-xs transition flex items-center justify-between ${editingPalletId === p.id ? 'bg-teal-700 text-teal-50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                    >
                      <div>
                        <div className="font-semibold">#{getDisplayLabel(p, palletsInSelectedCell)}</div>
                        <div className="opacity-75 truncate">{p.blend || '—'}</div>
                      </div>
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5 mb-3">
                  {palletsInSelectedCell.length < 3 && (
                    <button type="button" onClick={() => addPalletToCell(selectedCellId.row, selectedCellId.col)}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded text-xs transition"
                    >+ Add to Stack</button>
                  )}
                  <button type="button" onClick={() => deleteCell(selectedCellId.row, selectedCellId.col)}
                    className="flex-1 px-3 py-2 bg-red-700 hover:bg-red-600 text-red-50 font-semibold rounded text-xs transition flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />Delete Cell
                  </button>
                </div>

                {selectedPallet && (
                  <div className="pt-3 border-t border-slate-700">
                    <PalletDetailPanel
                      pallet={selectedPallet}
                      cellPallets={palletsInSelectedCell}
                      onUpdate={updatePallet}
                      onDelete={deletePallet}
                      getDisplayLabel={getDisplayLabel}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Blend breakdown */}
      {Object.keys(stats.byBlend).length > 0 && (
        <div className="mt-3 mx-2 md:mx-3 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Active Inventory by Blend</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(stats.byBlend).sort((a, b) => b[1] - a[1]).map(([blend, qty]) => (
              <div key={blend} className="flex items-center justify-between text-xs bg-slate-800 rounded px-2 py-1">
                <span className="text-slate-200 truncate">{blend}</span>
                <span className="text-teal-400 font-mono ml-2">{qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────
function StatChip({ label, value, color }) {
  const colors = {
    slate: 'border-slate-700 text-slate-300',
    teal: 'border-teal-700 text-teal-400',
    red: 'border-red-800 text-red-400',
    amber: 'border-amber-800 text-amber-400',
  };
  return (
    <div className={`bg-slate-900 border ${colors[color]} rounded px-1.5 py-1`}>
      <div className="text-[9px] uppercase tracking-wide opacity-70 truncate">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2.5 h-2.5 rounded border ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function DoorCell({ side }) {
  return (
    <div className="aspect-square rounded bg-amber-500/20 border-2 border-dashed border-amber-500/60 flex items-center justify-center text-amber-300"
      title={`${side === 'west' ? 'West' : 'East'} entrance`}
    >
      <DoorOpen className="w-2.5 h-2.5" />
    </div>
  );
}

function GridCell({ palletsInCell, row, col, isSelected, addMode, highlighted, onClick, getDisplayLabel }) {
  if (!palletsInCell.length) {
    return (
      <button type="button" onClick={onClick}
        className={`aspect-square rounded border border-dashed transition ${addMode
            ? 'border-teal-500/40 bg-teal-900/10 hover:bg-teal-900/30'
            : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700'
          } ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''}`}
        title={`${cellId(row, col)} — empty`}
      />
    );
  }
  const isOld = palletsInCell[0].status === 'old_bad';
  return (
    <button type="button" onClick={onClick}
      title={`${cellId(row, col)}`}
      className={`aspect-square rounded border-2 ${isOld ? 'bg-red-700 border-red-400 text-red-50' : 'bg-teal-700 border-teal-400 text-teal-50'
        } ${!highlighted ? 'opacity-25' : ''} ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''
        } hover:scale-105 transition flex flex-col items-center justify-center relative font-semibold overflow-hidden text-[9px] md:text-[10px] p-0.5`}
    >
      {isOld && <AlertTriangle className="w-2 h-2 absolute top-0.5 right-0.5 text-red-200" />}
      <div className="leading-tight flex flex-col gap-px text-center">
        {palletsInCell.map(p => (
          <div key={p.id} className="font-bold">{getDisplayLabel(p, palletsInCell)}</div>
        ))}
      </div>
      {palletsInCell.length > 1 && (
        <div className="absolute bottom-0.5 right-0.5 text-[7px] bg-amber-500/80 text-slate-950 px-0.5 rounded-sm font-bold">
          ×{palletsInCell.length}
        </div>
      )}
    </button>
  );
}

function PalletDetailPanel({ pallet, cellPallets, onUpdate, onDelete, getDisplayLabel }) {
  const [form, setForm] = useState(pallet);
  const [customBlend, setCustomBlend] = useState('');
  const [bucketProduct, setBucketProduct] = useState('');
  const [bucketWeight, setBucketWeight] = useState('');

  useEffect(() => {
    setForm(pallet);
    setCustomBlend('');

    // Parse existing bucket product format: "Product Name (weight)"
    const match = pallet.blend?.match(/^(.+?)\s*\((\d+#)\)$/);
    if (match && BUCKET_PRODUCTS.includes(match[1])) {
      setBucketProduct(match[1]);
      setBucketWeight(match[2]);
    } else {
      setBucketProduct('');
      setBucketWeight('');
    }
  }, [pallet.id]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = () => {
    const final = { ...form };

    // Handle bucket products: combine product + weight
    if (form.blend === 'Bucket Products' && bucketProduct && bucketWeight) {
      final.blend = `${bucketProduct} (${bucketWeight})`;
    } else if (customBlend.trim()) {
      final.blend = customBlend.trim();
    }

    final.quantity = Number(final.quantity) || 0;
    final.stack_height = Math.max(1, Math.min(3, Number(final.stack_height) || 1));
    onUpdate(pallet.id, final);
  };

  const isOld = form.status === 'old_bad';
  const lbl = getDisplayLabel(form, cellPallets);

  // Check if current blend is a bucket product or custom
  const isBucketProduct = form.blend === 'Bucket Products' ||
    (form.blend && BUCKET_PRODUCTS.some(p => form.blend.startsWith(p)));
  const isCustomBlend = form.blend &&
    !COMMON_BLENDS.includes(form.blend) &&
    !isBucketProduct;

  const availableWeights = bucketProduct === 'Immunizer' ? IMMUNIZER_WEIGHTS : BUCKET_WEIGHTS;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-3 ${isOld ? 'bg-red-900/30 border border-red-700/50' : 'bg-teal-900/20 border border-teal-700/30'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Pallet #{lbl}</div>
            <div className={`text-lg font-bold ${isOld ? 'text-red-400' : 'text-teal-400'}`}>{form.blend || '—'}</div>
          </div>
          {isOld && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
        </div>
        <div className="space-y-1 text-xs text-slate-300 mb-2.5">
          {form.lot && <div className="flex justify-between"><span className="text-slate-400">Lot #:</span><span className="font-mono font-semibold">{form.lot}</span></div>}
          {form.quantity > 0 && <div className="flex justify-between"><span className="text-slate-400">Qty:</span><span className="font-semibold">{form.quantity} {form.units}</span></div>}
          {form.tag && <div className="flex justify-between"><span className="text-slate-400">Tag:</span><span className="italic opacity-90">{form.tag}</span></div>}
        </div>
        <button type="button" onClick={() => set('status', isOld ? 'active' : 'old_bad')}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 ${isOld
              ? 'bg-teal-600/40 text-teal-200 border border-teal-500/50 hover:bg-teal-600/60'
              : 'bg-red-600/40 text-red-200 border border-red-500/50 hover:bg-red-600/60'
            }`}
        >
          {isOld ? <><CheckCircle className="w-4 h-4" /> Mark as ACTIVE</> : <><AlertTriangle className="w-4 h-4" /> Mark as OLD / BAD</>}
        </button>
      </div>

      <div className="space-y-2.5">
        <Field label="Product / Blend">
          <select
            value={isCustomBlend ? '__custom' : (isBucketProduct ? 'Bucket Products' : (form.blend || ''))}
            onChange={e => {
              const val = e.target.value;
              set('blend', val);
              setCustomBlend('');
              if (val !== 'Bucket Products') {
                setBucketProduct('');
                setBucketWeight('');
              }
            }}
            className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs"
          >
            <option value="">— Select —</option>
            {COMMON_BLENDS.map(b => <option key={b} value={b}>{b}</option>)}
            <option value="__custom">+ Custom</option>
          </select>

          {/* Bucket Product Selection */}
          {form.blend === 'Bucket Products' && (
            <>
              <select
                value={bucketProduct}
                onChange={e => {
                  setBucketProduct(e.target.value);
                  setBucketWeight(''); // Reset weight when product changes
                }}
                className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs mt-1"
              >
                <option value="">— Select Bucket Product —</option>
                {BUCKET_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {bucketProduct && (
                <select
                  value={bucketWeight}
                  onChange={e => setBucketWeight(e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs mt-1"
                >
                  <option value="">— Select Weight —</option>
                  {availableWeights.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              )}

              {bucketProduct && bucketWeight && (
                <div className="mt-2 px-2 py-1.5 bg-teal-900/30 border border-teal-700/50 rounded text-xs text-teal-300">
                  Will save as: <span className="font-semibold">{bucketProduct} ({bucketWeight})</span>
                </div>
              )}
            </>
          )}

          {/* Custom Blend Input */}
          {(form.blend === '__custom' || isCustomBlend) && (
            <input type="text" value={customBlend || (isCustomBlend ? form.blend : '')}
              onChange={e => setCustomBlend(e.target.value)}
              placeholder="e.g. 22/20 AM Bov"
              className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs mt-1"
            />
          )}
        </Field>
        <Field label="Lot #">
          <input type="text" value={form.lot} onChange={e => set('lot', e.target.value)}
            placeholder="e.g. P0112326-05"
            className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs"
          />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Condition, location notes, etc."
            className="w-full bg-slate-800 text-slate-100 rounded px-2 py-2 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs resize-none"
          />
        </Field>

        <details className="pt-1 border-t border-slate-700/50">
          <summary className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold hover:text-slate-300 select-none cursor-pointer">More Details ▼</summary>
          <div className="space-y-2.5 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Qty">
                <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs"
                />
              </Field>
              <Field label="Units">
                <select value={form.units} onChange={e => set('units', e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs"
                >
                  {['bags', 'buckets', 'lbs', 'kg', 'tons'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Stack Height">
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3].map(h => (
                  <button key={h} type="button" onClick={() => set('stack_height', h)}
                    className={`py-1.5 rounded text-[9px] font-semibold transition ${form.stack_height === h ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                  >{h === 1 ? '1×' : `×${h}`}</button>
                ))}
              </div>
            </Field>
            <Field label="Tag">
              <input type="text" value={form.tag} onChange={e => set('tag', e.target.value)}
                placeholder="e.g. corner, broken"
                className="w-full bg-slate-800 text-slate-100 rounded px-2 py-1 border border-slate-700 focus:border-teal-500 focus:outline-none text-xs"
              />
            </Field>
          </div>
        </details>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={handleSave}
          className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2 rounded-lg text-sm transition"
        >Save Pallet</button>
        <button type="button" onClick={() => onDelete(pallet.id)}
          className="bg-red-800 hover:bg-red-700 text-red-50 font-semibold py-2 px-3 rounded-lg transition"
          title="Delete this pallet"
        ><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}
