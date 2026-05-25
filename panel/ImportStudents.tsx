// frontend/src/features/admin/ImportStudents.tsx
import React, { useState, useRef } from 'react'

interface Student {
  full_name: string
  email: string
  role: string
  plan_code: string
  valid: boolean
  error?: string
}

type ImportMode = 'manual' | 'excel' | 'ai'

export default function ImportStudents({ onImported }: { onImported: () => void }) {
  const [mode,     setMode]     = useState<ImportMode>('manual')
  const [preview,  setPreview]  = useState<Student[]>([])
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState('')
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Manual form state
  const [rows, setRows] = useState([
    { full_name:'', email:'', role:'student', plan_code:'basic' }
  ])

  const addRow = () => setRows([...rows, { full_name:'', email:'', role:'student', plan_code:'basic' }])
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i))
  const updateRow = (i: number, field: string, val: string) => {
    const updated = [...rows]
    updated[i] = { ...updated[i], [field]: val }
    setRows(updated)
  }

  // Parse CSV
  const parseCSV = (text: string): Student[] => {
    const lines = text.split('\n').filter(l => l.trim())
    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g,''))
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g,''))
      const obj: any = {}
      header.forEach((h, i) => obj[h] = vals[i] || '')
      const name  = obj['nombre'] || obj['nombre completo'] || obj['full_name'] || ''
      const email = obj['correo'] || obj['email'] || obj['correo electronico'] || ''
      const role  = obj['rol'] || obj['role'] || 'student'
      const plan  = obj['plan'] || obj['plan_code'] || 'basic'
      return {
        full_name: name, email, role, plan_code: plan,
        valid: !!(name && email && email.includes('@')),
        error: !name ? 'Falta nombre' : !email ? 'Falta correo' : !email.includes('@') ? 'Correo inválido' : undefined
      }
    }).filter(s => s.full_name || s.email)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setPreview([])

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      const text = await file.text()
      setPreview(parseCSV(text))
      setMode('excel')
      return
    }

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setLoading(true)
      setProgress('Leyendo archivo Excel...')
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/v1/admin/import/excel', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
          body: formData
        })
        const data = await res.json()
        setPreview(data.students || [])
        setMode('excel')
      } catch {
        setError('Error al leer el archivo Excel')
      }
      setLoading(false)
      setProgress('')
      return
    }

    // PDF o imagen — usar IA
    setLoading(true)
    setMode('ai')
    const msgs = [
      'Analizando documento con IA...',
      'Extrayendo nombres y correos...',
      'Validando datos...',
      'Preparando vista previa...'
    ]
    for (const msg of msgs) {
      setProgress(msg)
      await new Promise(r => setTimeout(r, 800))
    }
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/v1/admin/import/ai', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        body: formData
      })
      const data = await res.json()
      setPreview(data.students || [])
    } catch {
      setError('Error al procesar con IA')
    }
    setLoading(false)
    setProgress('')
  }

  const importAll = async () => {
    setLoading(true); setError(''); setSuccess('')
    const toImport = mode === 'manual'
      ? rows.filter(r => r.full_name && r.email).map(r => ({ ...r, valid: true }))
      : preview.filter(s => s.valid)

    if (toImport.length === 0) { setError('No hay usuarios válidos para importar'); setLoading(false); return }

    let ok = 0; let fail = 0
    for (const s of toImport) {
      setProgress(`Importando ${ok + fail + 1} de ${toImport.length}...`)
      try {
        const res = await fetch('/api/v1/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
          body: JSON.stringify({
            full_name: s.full_name,
            email: s.email,
            password: 'icfes2026',
            role: s.role || 'student',
            plan_code: s.plan_code || 'basic'
          })
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }

    setSuccess(`✓ ${ok} usuarios importados correctamente${fail > 0 ? `. ${fail} fallaron (correos duplicados).` : '.'}`)
    setProgress('')
    setLoading(false)
    onImported()
  }

  return (
    <div style={{ fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
      <style>{`
        .import-tab { padding:8px 16px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#475569;font-family:inherit;transition:all 0.15s; }
        .import-tab.active { background:rgba(37,99,235,0.12);border-color:rgba(37,99,235,0.3);color:#60a5fa; }
        .ifield { width:100%;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:7px;color:#e2e8f0;font-size:12px;outline:none;font-family:inherit; }
        .ifield:focus { border-color:rgba(37,99,235,0.4); }
        select.ifield option { background:#0d1230; }
      `}</style>

      {/* TABS */}
      <div style={{ display:'flex',gap:8,marginBottom:16 }}>
        {[
          { key:'manual', label:'✍ Manual', desc:'Uno por uno' },
          { key:'excel',  label:'📊 Excel/CSV', desc:'Carga masiva' },
          { key:'ai',     label:'🤖 IA',    desc:'PDF/imagen' },
        ].map(t => (
          <button key={t.key} className={`import-tab ${mode===t.key?'active':''}`} onClick={()=>{ setMode(t.key as ImportMode); setPreview([]); setError(''); setSuccess('') }}>
            {t.label} <span style={{ fontSize:10,color:'#334155' }}>— {t.desc}</span>
          </button>
        ))}
      </div>

      {success && <div style={{ background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#34d399',marginBottom:12 }}>{success}</div>}
      {error   && <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#f87171',marginBottom:12 }}>⚠ {error}</div>}

      {/* MANUAL */}
      {mode === 'manual' && (
        <div>
          <div style={{ background:'rgba(12,18,38,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,overflow:'hidden',marginBottom:12 }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {['Nombre completo','Correo','Rol','Plan',''].map(h => (
                    <th key={h} style={{ fontSize:10,fontWeight:600,color:'#475569',padding:'8px 10px',textAlign:'left',letterSpacing:0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'6px 8px' }}><input className="ifield" placeholder="Juan Pérez" value={row.full_name} onChange={e=>updateRow(i,'full_name',e.target.value)} /></td>
                    <td style={{ padding:'6px 8px' }}><input className="ifield" placeholder="juan@edu.co" value={row.email} onChange={e=>updateRow(i,'email',e.target.value)} /></td>
                    <td style={{ padding:'6px 8px' }}>
                      <select className="ifield" value={row.role} onChange={e=>updateRow(i,'role',e.target.value)}>
                        <option value="student">Estudiante</option>
                        <option value="teacher">Docente</option>
                      </select>
                    </td>
                    <td style={{ padding:'6px 8px' }}>
                      <select className="ifield" value={row.plan_code} onChange={e=>updateRow(i,'plan_code',e.target.value)}>
                        <option value="basic">Básico</option>
                        <option value="plus">Plus</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td style={{ padding:'6px 8px' }}>
                      <button onClick={()=>removeRow(i)} style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:6,color:'#f87171',fontSize:12,padding:'4px 8px',cursor:'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={addRow} style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#94a3b8',fontSize:12,padding:'8px 16px',cursor:'pointer' }}>+ Agregar fila</button>
            <button onClick={importAll} disabled={loading} style={{ background:'#2563eb',border:'none',borderRadius:8,color:'#fff',fontSize:12,fontWeight:600,padding:'8px 20px',cursor:'pointer' }}>
              {loading ? progress || 'Importando...' : `Importar ${rows.filter(r=>r.full_name&&r.email).length} usuarios`}
            </button>
          </div>
          <div style={{ fontSize:11,color:'#334155',marginTop:8 }}>💡 La contraseña inicial será <strong style={{color:'#60a5fa'}}>icfes2026</strong> — el usuario puede cambiarla después.</div>
        </div>
      )}

      {/* EXCEL/CSV */}
      {mode === 'excel' && (
        <div>
          {preview.length === 0 && (
            <div
              onClick={()=>fileRef.current?.click()}
              style={{ border:'2px dashed rgba(37,99,235,0.3)',borderRadius:12,padding:'32px 20px',textAlign:'center',cursor:'pointer',background:'rgba(37,99,235,0.04)',transition:'all 0.2s' }}
            >
              <div style={{ fontSize:32,marginBottom:10 }}>📊</div>
              <div style={{ fontSize:14,fontWeight:500,color:'#60a5fa',marginBottom:6 }}>Subir Excel o CSV</div>
              <div style={{ fontSize:12,color:'#475569',marginBottom:12 }}>Arrastra o haz clic para seleccionar</div>
              <div style={{ fontSize:11,color:'#334155' }}>
                Columnas requeridas: <strong style={{color:'#94a3b8'}}>nombre, correo</strong> | Opcionales: rol, plan
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" style={{ display:'none' }} onChange={handleFile} />
            </div>
          )}

          {loading && (
            <div style={{ textAlign:'center',padding:20,color:'#60a5fa',fontSize:13 }}>⏳ {progress}</div>
          )}

          {preview.length > 0 && (
            <div>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <div style={{ fontSize:13,color:'#94a3b8' }}>
                  <span style={{ color:'#34d399',fontWeight:600 }}>{preview.filter(s=>s.valid).length} válidos</span>
                  {preview.filter(s=>!s.valid).length > 0 && <span style={{ color:'#f87171',marginLeft:8 }}>{preview.filter(s=>!s.valid).length} con error</span>}
                </div>
                <button onClick={()=>{ setPreview([]); if(fileRef.current) fileRef.current.value='' }} style={{ background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#64748b',fontSize:11,padding:'4px 10px',cursor:'pointer' }}>Limpiar</button>
              </div>
              <div style={{ background:'rgba(12,18,38,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,overflow:'hidden',marginBottom:12,maxHeight:300,overflowY:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      {['Nombre','Correo','Rol','Plan','Estado'].map(h => (
                        <th key={h} style={{ fontSize:10,fontWeight:600,color:'#475569',padding:'8px 10px',textAlign:'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((s, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)',background:s.valid?'transparent':'rgba(239,68,68,0.03)' }}>
                        <td style={{ padding:'8px 10px',fontSize:12,color:'#e2e8f0' }}>{s.full_name}</td>
                        <td style={{ padding:'8px 10px',fontSize:12,color:'#94a3b8' }}>{s.email}</td>
                        <td style={{ padding:'8px 10px',fontSize:11,color:'#64748b' }}>{s.role}</td>
                        <td style={{ padding:'8px 10px',fontSize:11,color:'#64748b' }}>{s.plan_code}</td>
                        <td style={{ padding:'8px 10px' }}>
                          {s.valid
                            ? <span style={{ fontSize:10,color:'#34d399',background:'rgba(52,211,153,0.1)',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(52,211,153,0.2)' }}>✓ OK</span>
                            : <span style={{ fontSize:10,color:'#f87171',background:'rgba(239,68,68,0.1)',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(239,68,68,0.2)' }}>✗ {s.error}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={importAll} disabled={loading} style={{ background:'#2563eb',border:'none',borderRadius:8,color:'#fff',fontSize:12,fontWeight:600,padding:'10px 24px',cursor:'pointer' }}>
                {loading ? progress : `Importar ${preview.filter(s=>s.valid).length} usuarios válidos`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* IA */}
      {mode === 'ai' && (
        <div>
          {preview.length === 0 && !loading && (
            <div
              onClick={()=>fileRef.current?.click()}
              style={{ border:'2px dashed rgba(124,58,237,0.3)',borderRadius:12,padding:'32px 20px',textAlign:'center',cursor:'pointer',background:'rgba(124,58,237,0.04)' }}
            >
              <div style={{ fontSize:32,marginBottom:10 }}>🤖</div>
              <div style={{ fontSize:14,fontWeight:500,color:'#a78bfa',marginBottom:6 }}>Carga con IA</div>
              <div style={{ fontSize:12,color:'#475569',marginBottom:12 }}>Sube un PDF, imagen o lista mal formada</div>
              <div style={{ fontSize:11,color:'#334155' }}>La IA extrae automáticamente nombres y correos</div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv" style={{ display:'none' }} onChange={handleFile} />
            </div>
          )}
          {loading && (
            <div style={{ textAlign:'center',padding:32 }}>
              <div style={{ fontSize:24,marginBottom:12 }}>🤖</div>
              <div style={{ fontSize:14,color:'#a78bfa',fontWeight:500,marginBottom:6 }}>Procesando con IA...</div>
              <div style={{ fontSize:12,color:'#475569' }}>{progress}</div>
            </div>
          )}
          {preview.length > 0 && (
            <div>
              <div style={{ fontSize:13,color:'#94a3b8',marginBottom:10 }}>
                IA extrajo <span style={{ color:'#a78bfa',fontWeight:600 }}>{preview.length} registros</span>. Revisa y confirma.
              </div>
              <div style={{ background:'rgba(12,18,38,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,overflow:'hidden',marginBottom:12 }}>
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead>
                    <tr><th style={{ fontSize:10,fontWeight:600,color:'#475569',padding:'8px 10px',textAlign:'left' }}>Nombre</th><th style={{ fontSize:10,fontWeight:600,color:'#475569',padding:'8px 10px',textAlign:'left' }}>Correo</th><th style={{ fontSize:10,fontWeight:600,color:'#475569',padding:'8px 10px',textAlign:'left' }}>Estado</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((s,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'8px 10px',fontSize:12,color:'#e2e8f0' }}>{s.full_name}</td>
                        <td style={{ padding:'8px 10px',fontSize:12,color:'#94a3b8' }}>{s.email}</td>
                        <td style={{ padding:'8px 10px' }}><span style={{ fontSize:10,color:s.valid?'#34d399':'#f87171' }}>{s.valid?'✓ Válido':'✗ '+s.error}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={importAll} disabled={loading} style={{ background:'#7c3aed',border:'none',borderRadius:8,color:'#fff',fontSize:12,fontWeight:600,padding:'10px 24px',cursor:'pointer' }}>
                Confirmar e importar {preview.filter(s=>s.valid).length} usuarios
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
