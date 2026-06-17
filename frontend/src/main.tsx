import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: string | null; stack: string}> {
  constructor(props: any) { super(props); this.state = { error: null, stack: '' } }
  static getDerivedStateFromError(e: Error) { return { error: e.message, stack: e.stack || '' } }
  componentDidCatch(e: Error, info: any) {
    console.error('[ErrorBoundary]', e, info?.componentStack)
  }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight:'100vh', background:'#040813', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif', color:'#e2e8f0', flexDirection:'column', gap:16, padding:24 }}>
        <div style={{ fontSize:40 }}>⚠️</div>
        <h2 style={{ fontSize:20, margin:0 }}>Error de la aplicación</h2>
        <p style={{ color:'#f87171', fontSize:13, maxWidth:500, textAlign:'center', background:'rgba(239,68,68,0.08)', padding:'10px 16px', borderRadius:8, border:'1px solid rgba(239,68,68,0.2)' }}>{this.state.error}</p>
        <pre style={{ color:'#475569', fontSize:10, maxWidth:600, overflow:'auto', background:'rgba(255,255,255,0.03)', padding:12, borderRadius:8, maxHeight:200 }}>{this.state.stack.slice(0, 800)}</pre>
        <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload() }} style={{ padding:'10px 24px', background:'#2563eb', border:'none', borderRadius:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
          Limpiar caché y recargar
        </button>
        <button onClick={() => window.location.reload()} style={{ padding:'8px 20px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer' }}>
          Solo recargar
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
