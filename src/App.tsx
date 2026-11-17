import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'
import { AuthGate } from './app/AuthGate'
import { EmployeeGate } from './app/EmployeeGate'
import { EventGate } from './app/EventGate'
import { AppLayout } from './shared/ui/AppLayout'

export function App() {
  return (
    <AppProviders>
      <AuthGate>
        <EventGate>
          <EmployeeGate>
            <BrowserRouter>
              <AppLayout>
                <AppRouter />
              </AppLayout>
            </BrowserRouter>
          </EmployeeGate>
        </EventGate>
      </AuthGate>
    </AppProviders>
  )
}
