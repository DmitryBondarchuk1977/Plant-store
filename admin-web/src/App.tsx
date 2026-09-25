import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { Login } from './auth/Login'
import { CatalogTable } from './catalog/CatalogTable'
import { Menu, type MenuItem } from './ui/Menu'
import { Placeholder } from './views/Placeholder'
import { RequestsView } from './views/RequestsView'
import { AnnouncementsView } from './views/AnnouncementsView'
import { UsersView } from './views/UsersView'

type Theme = 'light' | 'dark'
type View =
  | 'catalog'
  | 'requests'
  | 'announcements'
  | 'users'
  | 'analytics'
  | 'settings'

const NAV: MenuItem[] = [
  { key: 'catalog', label: 'Каталог', icon: '📋' },
  { key: 'requests', label: 'Заявки', icon: '🧾' },
  { key: 'announcements', label: 'Анонсы', icon: '📣' },
  { key: 'users', label: 'Пользователи', icon: '👥' },
  { key: 'analytics', label: 'Аналитика', icon: '📊' },
  { key: 'settings', label: 'Настройки', icon: '⚙️' },
]

function getInitialTheme(): Theme {
  try {
    const s = localStorage.getItem('theme')
    if (s === 'light' || s === 'dark') return s
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [view, setView] = useState<View>('catalog')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const themeBtn = (
    <button
      className="icon-btn theme-toggle"
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  )

  if (loading) {
    return (
      <div className="center">
        <span className="theme-float">{themeBtn}</span>
        <div className="muted">Загрузка…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <span className="theme-float">{themeBtn}</span>
        <Login />
      </>
    )
  }

  if (!isAdmin) {
    return (
      <div className="center">
        <span className="theme-float">{themeBtn}</span>
        <div className="card auth-card">
          <h1 className="auth-title">Нет доступа</h1>
          <p className="auth-sub">
            Аккаунт <b>{session.user.email}</b> не в списке администраторов.
          </p>
          <button className="btn" onClick={signOut}>
            Выйти
          </button>
        </div>
      </div>
    )
  }

  const currentLabel = NAV.find((n) => n.key === view)?.label ?? ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <Menu items={NAV} current={view} onSelect={(k) => setView(k as View)} />
          <div className="brand">🌿 {currentLabel}</div>
        </div>
        <div className="topbar-right">
          {themeBtn}
          <span className="muted hide-sm">{session.user.email}</span>
          <button className="btn btn-sm" onClick={signOut}>
            Выйти
          </button>
        </div>
      </header>
      <main className="content">
        {view === 'catalog' && <CatalogTable />}
        {view === 'requests' && <RequestsView />}
        {view === 'announcements' && <AnnouncementsView />}
        {view === 'users' && <UsersView />}
        {view === 'analytics' && (
          <Placeholder
            title="Аналитика"
            note="Продажи и маржа по категориям, топ растений — добавим на следующем шаге."
          />
        )}
        {view === 'settings' && (
          <Placeholder
            title="Настройки"
            note="Администраторы, тема и прочие параметры — добавим на следующем шаге."
          />
        )}
      </main>
    </div>
  )
}
