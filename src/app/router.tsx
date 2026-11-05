import { Route, Routes } from 'react-router-dom'
import { ClosingPage } from '../features/closing/ClosingPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { PosPage } from '../features/pos/PosPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TransactionsPage } from '../features/transactions/TransactionsPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PosPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/voorraad" element={<InventoryPage />} />
      <Route path="/transacties" element={<TransactionsPage />} />
      <Route path="/dagafsluiting" element={<ClosingPage />} />
      <Route path="/instellingen" element={<SettingsPage />} />
    </Routes>
  )
}
