import { Route, Routes } from 'react-router-dom'
import { ClosingPage } from '../features/closing/ClosingPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { PosPage } from '../features/pos/PosPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TransactionsPage } from '../features/transactions/TransactionsPage'
import { RequireManager } from './RequireManager'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PosPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireManager>
            <DashboardPage />
          </RequireManager>
        }
      />
      <Route path="/voorraad" element={<InventoryPage />} />
      <Route path="/transacties" element={<TransactionsPage />} />
      <Route
        path="/dagafsluiting"
        element={
          <RequireManager>
            <ClosingPage />
          </RequireManager>
        }
      />
      <Route path="/instellingen" element={<SettingsPage />} />
    </Routes>
  )
}
