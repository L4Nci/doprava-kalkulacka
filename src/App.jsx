import { useState } from 'react'
import MainApp from './components/MainApp'
import Admin from './components/Admin'
import LoginForm from './components/LoginForm'

function App() {
  const [showAdmin, setShowAdmin] = useState(false)
  const [showLoginForm, setShowLoginForm] = useState(false)

  const handleAdminClick = () => {
    setShowLoginForm(true)
  }

  const handleLogin = () => {
    setShowLoginForm(false)
    setShowAdmin(true)
  }

  const handleCancel = () => {
    setShowLoginForm(false)
  }

  return (
    <div>
      {!showAdmin ? (
        <>
          <MainApp />
          <div className="fixed bottom-4 right-4">
            <button
              onClick={handleAdminClick}
              className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
            >
              Admin login
            </button>
          </div>
          {showLoginForm && (
            <LoginForm onLogin={handleLogin} onCancel={handleCancel} />
          )}
        </>
      ) : (
        <Admin onBack={() => setShowAdmin(false)} />
      )}
    </div>
  )
}

export default App
