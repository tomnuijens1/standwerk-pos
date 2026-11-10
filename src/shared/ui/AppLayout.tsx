import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useActiveEmployee } from '../../features/employees/useActiveEmployee'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/', label: 'Kassa', end: true, managerOnly: false },
  { to: '/dashboard', label: 'Dashboard', end: false, managerOnly: true },
  { to: '/voorraad', label: 'Voorraad', end: false, managerOnly: false },
  { to: '/transacties', label: 'Transacties', end: false, managerOnly: false },
  { to: '/dagafsluiting', label: 'Dagafsluiting', end: false, managerOnly: true },
  { to: '/instellingen', label: 'Instellingen', end: false, managerOnly: false },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { employee } = useActiveEmployee()
  const isManager = employee?.role === 'manager'
  const items = NAV_ITEMS.filter((item) => !item.managerOnly || isManager)

  return (
    <div className="app">
      <nav className="side" aria-label="Hoofdmenu">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true" />
          <span className="logo-name">Standwerk</span>
        </div>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">{children}</main>
      <nav className="bottom-nav" aria-label="Hoofdmenu">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
