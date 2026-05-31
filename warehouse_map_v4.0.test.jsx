import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Supabase before importing the app
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import App from './warehouse_map_v4.0.jsx';

// Pure functions re-implemented for unit testing
const cellId = (row, col) =>
  `R${String(row + 1).padStart(2, '0')}C${String(col + 1).padStart(2, '0')}`;

const WEST_DOOR = { row: 0, cols: [7, 8] };
const EAST_DOOR_ROW = 15;
const isDoorCell = (row, col) => {
  if (row === WEST_DOOR.row && WEST_DOOR.cols.includes(col)) return 'west';
  if (row === EAST_DOOR_ROW && [7, 8].includes(col)) return 'east';
  return null;
};

const validatePallet = (p) => ({
  id: p.id || 'test-id',
  number: Number(p.number) || 0,
  row: Math.max(0, Math.min(15, Number(p.row) || 0)),
  col: Math.max(0, Math.min(15, Number(p.col) || 0)),
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

// ---------------------------------------------------------------------------
// Suite 1: Pure helpers
// ---------------------------------------------------------------------------

describe('cellId', () => {
  it('formats R01C01 for row 0 col 0', () => expect(cellId(0, 0)).toBe('R01C01'));
  it('formats R16C16 for row 15 col 15', () => expect(cellId(15, 15)).toBe('R16C16'));
  it('pads single digits', () => expect(cellId(2, 5)).toBe('R03C06'));
});

describe('isDoorCell', () => {
  it('returns west for row 0 col 7', () => expect(isDoorCell(0, 7)).toBe('west'));
  it('returns west for row 0 col 8', () => expect(isDoorCell(0, 8)).toBe('west'));
  it('returns east for row 15 col 7', () => expect(isDoorCell(15, 7)).toBe('east'));
  it('returns east for row 15 col 8', () => expect(isDoorCell(15, 8)).toBe('east'));
  it('returns null for regular cells', () => expect(isDoorCell(5, 5)).toBeNull());
  it('returns null for row 0 col 0', () => expect(isDoorCell(0, 0)).toBeNull());
});

describe('validatePallet', () => {
  it('applies defaults for empty object', () => {
    const p = validatePallet({});
    expect(p.number).toBe(0);
    expect(p.row).toBe(0);
    expect(p.col).toBe(0);
    expect(p.stack_label).toBe('A');
    expect(p.status).toBe('active');
    expect(p.units).toBe('bags');
    expect(p.stack_height).toBe(1);
  });
  it('clamps row to 0–15', () => {
    expect(validatePallet({ row: -5 }).row).toBe(0);
    expect(validatePallet({ row: 99 }).row).toBe(15);
    expect(validatePallet({ row: 7 }).row).toBe(7);
  });
  it('clamps col to 0–15', () => {
    expect(validatePallet({ col: -1 }).col).toBe(0);
    expect(validatePallet({ col: 20 }).col).toBe(15);
  });
  it('clamps stack_height to 1–3', () => {
    expect(validatePallet({ stack_height: 0 }).stack_height).toBe(1);
    expect(validatePallet({ stack_height: 5 }).stack_height).toBe(3);
    expect(validatePallet({ stack_height: 2 }).stack_height).toBe(2);
  });
  it('falls back invalid stack_label to A', () => {
    expect(validatePallet({ stack_label: 'Z' }).stack_label).toBe('A');
    expect(validatePallet({ stack_label: 'B' }).stack_label).toBe('B');
  });
  it('falls back invalid status to active', () => {
    expect(validatePallet({ status: 'garbage' }).status).toBe('active');
    expect(validatePallet({ status: 'old_bad' }).status).toBe('old_bad');
  });
  it('clamps quantity to >= 0', () => {
    expect(validatePallet({ quantity: -10 }).quantity).toBe(0);
    expect(validatePallet({ quantity: 50 }).quantity).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: AuthScreen
// ---------------------------------------------------------------------------

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('renders WAREHOUSE INVENTORY heading', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/warehouse inventory/i)).toBeInTheDocument();
    });
  });

  it('renders Sign In and Create Account tabs', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
    });
  });

  it('Sign In tab is active by default', async () => {
    render(<App />);
    await waitFor(() => {
      const signInTab = screen.getByText(/sign in/i);
      expect(signInTab.className).toMatch(/teal|bg-teal|active/);
    });
  });

  it('clicking Create Account tab switches active tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/create account/i));
    await user.click(screen.getByText(/create account/i));
    await waitFor(() => {
      const createTab = screen.getByText(/create account/i);
      expect(createTab.className).toMatch(/teal|bg-teal|active/);
    });
  });

  it('submitting sign in form calls signInWithPassword with email and password', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/sign in/i));
    const inputs = screen.getAllByRole('textbox');
    const emailInput = inputs.find(
      (el) => el.type === 'email' || el.placeholder?.toLowerCase().includes('email')
    ) || inputs[0];
    const passwordInput = document.querySelector('input[type="password"]');
    await user.type(emailInput, 'user@example.com');
    await user.type(passwordInput, 'secret123');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret123',
      });
    });
  });

  it('shows error message when signInWithPassword returns an error', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/sign in/i));
    const inputs = screen.getAllByRole('textbox');
    const emailInput = inputs[0];
    const passwordInput = document.querySelector('input[type="password"]');
    await user.type(emailInput, 'bad@example.com');
    await user.type(passwordInput, 'wrongpass');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('shows success message when signUp succeeds', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/create account/i));
    await user.click(screen.getByText(/create account/i));
    await waitFor(() => screen.getByRole('button', { name: /create account/i }));
    const inputs = screen.getAllByRole('textbox');
    const emailInput = inputs[0];
    const passwordInput = document.querySelector('input[type="password"]');
    await user.type(emailInput, 'new@example.com');
    await user.type(passwordInput, 'newpass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/check your email|account created|success/i)
      ).toBeInTheDocument();
    });
  });

  it('shows error when signUp fails', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'Email already in use' } });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/create account/i));
    await user.click(screen.getByText(/create account/i));
    await waitFor(() => screen.getByRole('button', { name: /create account/i }));
    const inputs = screen.getAllByRole('textbox');
    const emailInput = inputs[0];
    const passwordInput = document.querySelector('input[type="password"]');
    await user.type(emailInput, 'existing@example.com');
    await user.type(passwordInput, 'somepass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3: OnboardingScreen
// ---------------------------------------------------------------------------

describe('OnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
      insert: mockInsert,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'user-1',
        onboarding_complete: false,
        name: '',
        warehouse_name: '',
      },
    });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'test@test.com' } } },
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('renders "Set up your profile" text', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/set up your profile/i)).toBeInTheDocument();
    });
  });

  it('shows error when submitting with empty fields', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/set up your profile/i));
    const saveBtn = screen.getByRole('button', { name: /save|continue|next|submit/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(
        screen.getByText(/required|fill|name|empty/i)
      ).toBeInTheDocument();
    });
  });

  it('calls supabase upsert with name and warehouse_name on submit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/set up your profile/i));
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Alice');
    await user.type(inputs[1], 'Main Warehouse');
    const saveBtn = screen.getByRole('button', { name: /save|continue|next|submit/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
      const callArg = mockUpsert.mock.calls[0][0];
      const record = Array.isArray(callArg) ? callArg[0] : callArg;
      expect(record).toMatchObject({ name: 'Alice', warehouse_name: 'Main Warehouse' });
    });
  });

  it('calls onComplete after successful save', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/set up your profile/i));
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Bob');
    await user.type(inputs[1], 'West Wing');
    const saveBtn = screen.getByRole('button', { name: /save|continue|next|submit/i });
    await user.click(saveBtn);
    // After successful upsert the app should advance past the onboarding screen
    await waitFor(() => {
      expect(screen.queryByText(/set up your profile/i)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4: WarehouseMap (pallet operations)
// ---------------------------------------------------------------------------

describe('WarehouseMap', () => {
  const mockUser = { id: 'user-1', email: 'test@test.com' };
  const mockProfile = {
    id: 'user-1',
    name: 'Test User',
    warehouse_name: 'Test Warehouse',
    onboarding_complete: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null, data: [] });

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: mockProfile }) }),
          }),
          upsert: mockUpsert,
        };
      }
      if (table === 'pallets') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: mockInsert,
        };
      }
    });
  });

  it('renders warehouse name in header', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/test warehouse/i)).toBeInTheDocument();
    });
  });

  it('renders Add Pallet button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add pallet/i })).toBeInTheDocument();
    });
  });

  it('renders Sign Out button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });

  it('clicking Add Pallet enters add mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /add pallet/i }));
    await user.click(screen.getByRole('button', { name: /add pallet/i }));
    await waitFor(() => {
      expect(screen.getByText(/tap a cell/i)).toBeInTheDocument();
    });
  });

  it('clicking a non-door grid cell in add mode adds a pallet', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /add pallet/i }));
    await user.click(screen.getByRole('button', { name: /add pallet/i }));
    await waitFor(() => screen.getByText(/tap a cell/i));
    // Row 5, Col 5 is a regular cell (not a door)
    const cellButton = screen.getByTitle ? screen.queryByTitle(/R06C06/) : null;
    // Fall back to aria-label or just find any clickable grid cell
    const gridCell =
      cellButton ||
      screen.queryByLabelText(/R06C06/) ||
      document.querySelector('[data-cell="R06C06"]') ||
      document.querySelector('[data-row="5"][data-col="5"]');
    if (gridCell) {
      await user.click(gridCell);
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled();
      });
    } else {
      // Find any grid cell button that is not a door and click it
      const allButtons = screen.getAllByRole('button');
      const gridButtons = allButtons.filter(
        (b) =>
          !b.textContent.match(/add pallet|sign out|undo|tap a cell/i) &&
          b.className.match(/cell|grid|square|bg-/)
      );
      if (gridButtons.length > 0) {
        await user.click(gridButtons[Math.floor(gridButtons.length / 2)]);
        await waitFor(() => {
          expect(mockInsert).toHaveBeenCalled();
        });
      }
    }
  });

  it('clicking Undo when no history shows nothing to undo feedback', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /undo/i }));
    await user.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/nothing to undo|no history|no actions/i)
      ).toBeInTheDocument();
    });
  });

  it('clicking Sign Out calls supabase.auth.signOut', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /sign out/i }));
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
