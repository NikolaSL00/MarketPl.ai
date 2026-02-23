import { Routes, Route, Navigate } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ImportPage } from '@/pages/ImportPage'
import { DataExplorerPage } from '@/pages/DataExplorerPage'
import { BacktestPage } from '@/pages/BacktestPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/import" replace />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/data" element={<DataExplorerPage />} />
        <Route path="/backtest" element={<BacktestPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
