import { useState } from 'react'
import MainApp from './components/MainApp'
import Admin from './components/Admin'

function App() {
  const [showAdmin, setShowAdmin] = useState(false)

  return (
    <div>
      {!showAdmin ? (
        <>
          <MainApp />
          <div className="fixed bottom-4 right-4">
            <button
              onClick={() => setShowAdmin(true)}
              className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
            >
              Admin login
            </button>
          </div>
        </>
      ) : (
        <Admin onBack={() => setShowAdmin(false)} />
      )}
    </div>
  )
}

export default App
