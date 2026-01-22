import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function getStoredAuth() {
  try {
    const raw = localStorage.getItem('ptm_auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(auth) {
  localStorage.setItem('ptm_auth', JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem('ptm_auth');
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');

  const [auth, setAuth] = useState(() => getStoredAuth());
  const token = auth?.token || null;

  const [activeView, setActiveView] = useState('tasks'); // tasks | login | register

  const [email, setEmail] = useState(auth?.user?.email || '');
  const [password, setPassword] = useState('');

  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'error'|'success'|'info', message: string }

  const isAuthed = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isAuthed) {
      setActiveView('tasks');
      void refreshTasks();
    } else {
      setActiveView('login');
      setTasks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  async function apiFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const message = data?.message || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function refreshTasks() {
    setLoading(true);
    setNotice(null);
    try {
      const data = await apiFetch('/tasks', { method: 'GET' });
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to load tasks' });
    } finally {
      setLoading(false);
    }
  }

  async function submitAuth(kind) {
    setLoading(true);
    setNotice(null);

    try {
      const endpoint = kind === 'register' ? '/auth/register' : '/auth/login';
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {}, // apiFetch adds JSON header
      });

      const nextAuth = { user: data.user, token: data.token };
      setAuth(nextAuth);
      storeAuth(nextAuth);
      setPassword('');
      setNotice({ type: 'success', message: kind === 'register' ? 'Account created!' : 'Welcome back!' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setAuth(null);
    clearAuth();
    setPassword('');
    setNotice({ type: 'info', message: 'Logged out' });
  }

  async function createTask(e) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setNotice({ type: 'error', message: 'Task title is required' });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const data = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }),
      });
      setTasks(prev => [data.task, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setNotice({ type: 'success', message: 'Task added' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to create task' });
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(id) {
    setLoading(true);
    setNotice(null);
    try {
      const data = await apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' });
      setTasks(prev => prev.map(t => (t._id === id ? data.task : t)));
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to update task' });
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(id) {
    setLoading(true);
    setNotice(null);
    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t._id !== id));
      setNotice({ type: 'success', message: 'Task deleted' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message || 'Failed to delete task' });
    } finally {
      setLoading(false);
    }
  }

  function TaskItem({ task }) {
    return (
      <li className="task-item" aria-label={`Task: ${task.title}`}>
        <label className="task-check">
          <input
            type="checkbox"
            checked={Boolean(task.completed)}
            onChange={() => toggleTask(task._id)}
            disabled={loading}
            aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
          />
          <span className={task.completed ? 'task-title done' : 'task-title'}>{task.title}</span>
        </label>

        {task.description ? <p className="task-desc">{task.description}</p> : null}

        <div className="task-actions">
          <button className="btn btn-secondary" onClick={() => deleteTask(task._id)} disabled={loading}>
            Delete
          </button>
        </div>
      </li>
    );
  }

  function AuthCard() {
    const isLogin = activeView === 'login';
    const title = isLogin ? 'Login' : 'Create account';

    return (
      <div className="card">
        <h2 className="card-title">{title}</h2>
        <p className="card-subtitle">Use any email + password (min 6 chars).</p>

        <form
          className="form"
          onSubmit={e => {
            e.preventDefault();
            void submitAuth(isLogin ? 'login' : 'register');
          }}
        >
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={loading}
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="At least 6 characters"
              disabled={loading}
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="switcher">
          {isLogin ? (
            <>
              <span>New here?</span>
              <button className="link" onClick={() => setActiveView('register')} disabled={loading}>
                Create an account
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button className="link" onClick={() => setActiveView('login')} disabled={loading}>
                Login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function TasksView() {
    const completedCount = tasks.filter(t => t.completed).length;

    return (
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              TM
            </div>
            <div className="brand-text">
              <div className="brand-title">Task Manager</div>
              <div className="brand-subtitle">Personal</div>
            </div>
          </div>

          <nav className="nav">
            <button className="nav-item active" onClick={() => setActiveView('tasks')}>
              Tasks
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="small">
              Signed in as <strong>{auth?.user?.email}</strong>
            </div>
            <button className="btn btn-secondary" onClick={logout} disabled={loading}>
              Logout
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <h1 className="h1">My Tasks</h1>
              <div className="pill">
                {completedCount}/{tasks.length} completed
              </div>
            </div>

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>

          {notice ? (
            <div className={`notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
              {notice.message}
            </div>
          ) : null}

          <div className="grid">
            <section className="card">
              <h2 className="card-title">Add a task</h2>
              <form className="form" onSubmit={createTask}>
                <label className="field">
                  <span className="label">Title</span>
                  <input
                    className="input"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g., Read 10 pages"
                    disabled={loading}
                  />
                </label>
                <label className="field">
                  <span className="label">Description (optional)</span>
                  <textarea
                    className="textarea"
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Add some details…"
                    rows={3}
                    disabled={loading}
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  Add task
                </button>
              </form>
            </section>

            <section className="card">
              <div className="card-head">
                <h2 className="card-title">Task list</h2>
                <button className="btn btn-secondary" onClick={() => refreshTasks()} disabled={loading}>
                  Refresh
                </button>
              </div>

              {loading && tasks.length === 0 ? <div className="muted">Loading…</div> : null}

              {tasks.length === 0 && !loading ? (
                <div className="muted">No tasks yet. Add one on the left.</div>
              ) : (
                <ul className="task-list">
                  {tasks.map(t => (
                    <TaskItem key={t._id} task={t} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-shell">
        {!isAuthed ? (
          <div className="auth-shell">
            <div className="auth-header">
              <div>
                <h1 className="h1">Task Manager</h1>
                <p className="muted">Register, login, and manage your tasks.</p>
              </div>
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? 'Dark' : 'Light'}
              </button>
            </div>

            {notice ? (
              <div className={`notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
                {notice.message}
              </div>
            ) : null}

            <AuthCard />

            <p className="small muted">
              API: <code>{API_BASE}</code>
            </p>
          </div>
        ) : (
          <TasksView />
        )}
      </header>
    </div>
  );
}

export default App;

