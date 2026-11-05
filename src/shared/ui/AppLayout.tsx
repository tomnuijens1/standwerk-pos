import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/', label: 'Kassa', end: true },
  { to: '/dashboard', label: 'Dashboard', end: false },
  { to: '/voorraad', label: 'Voorraad', end: false },
  { to: '/transacties', label: 'Transacties', end: false },
  { to: '/dagafsluiting', label: 'Dagafsluiting', end: false },
  { to: '/instellingen', label: 'Instellingen', end: false },
]

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <nav className="side" aria-label="Hoofdmenu">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true" />
          <span className="logo-name">Standwerk</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">{children}</main>
      <nav className="bottom-nav" aria-label="Hoofdmenu">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
