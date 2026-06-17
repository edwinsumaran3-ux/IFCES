import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: string | null}> {
  constructor(props: any) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight:'100vh', background:'#040813', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif', color:'#e2e8f0', flexDirection:'column', gap:16, padding:24 }}>
        <div style={{ fontSize:40 }}>⚠️</div>
        <h2 style={{ fontSize:20, margin:0 }}>Error de la aplicación</h2>
        <p style={{ color:'#475569', fontSize:13, maxWidth:400, textAlign:'center' }}>{this.state.error}</p>
        <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload() }} style={{ padding:'10px 24px', background:'#2563eb', border:'none', borderRadius:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
          Limpiar caché y recargar
        </button>
      </div>
    )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
