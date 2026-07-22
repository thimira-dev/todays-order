import { Routes, Route, NavLink } from 'react-router-dom'
import { IsoCroissant, IsoClipboard, IsoReceipt } from './components/icons'
import OrderScreen from './pages/OrderScreen'
import PreRunChecklist from './pages/PreRunChecklist'
import RunSettlement from './pages/RunSettlement'

const NAV_ITEMS = [
  { to: '/', label: 'Order', icon: IsoCroissant, end: true },
  { to: '/checklist', label: 'Checklist', icon: IsoClipboard, end: false },
  { to: '/settlement', label: 'Settlement', icon: IsoReceipt, end: false },
]

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-semibold">Today's Order</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <Routes>
          <Route path="/" element={<OrderScreen />} />
          <Route path="/checklist" element={<PreRunChecklist />} />
          <Route path="/settlement" element={<RunSettlement />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                  isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
