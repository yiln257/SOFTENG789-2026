import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  // 严格模式在开发环境下会渲染两次以检查副作用，为了 Socket 调试方便，这里可暂时保留或去掉
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)