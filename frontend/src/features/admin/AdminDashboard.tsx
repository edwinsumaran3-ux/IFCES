// frontend/src/features/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react'
import ImportStudents from './ImportStudents'

interface User { id: string; full_name: string; email: string; role: string; is_active: boolean; plan_code: string; created_at: string }
interface Payment { id: string; student_name: string; plan: string; amount: number; nequi_ref: string; status: string; created_at: string }

type Tab = 'overview' | 'students' | 'teachers' | 'import' | 'payments' | 'plans'

const API = (path: string, opts?: RequestInit) =>
  fetch(`/api/v1${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, ...opts?.headers }
  }).then(r => r.json())

export default function AdminDashboard() {
  const [tab,      setTab]      = useState<Tab>('overview')
  const [users,    setUsers]    = useState<User[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ full_name:'', email:'', password:'', role:'student', plan_code:'basic' })
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  useEffect(() => { loadUsers(); loadPayments() }, [])

  const loadUsers = async () => {
    setLoading(true)
    try { const d = await API('/admin/users'); setUsers(d.users || []) } catch {}
    setLoading(false)
  }

  const loadPayments = async () => {
    try { const d = await API('/admin/payments'); setPayments(d.payments || []) } catch {}
  }

  const createUser = async () => {
    setError(''); setSuccess('')
    if (!form.full_name || !form.email || !form.password) { setError('Completa todos los campos'); return }
    try {
      const d = await API('/admin/users', { method:'POST', body:JSON.stringify(form) })
      if (d.error) throw new Error(d.error)
      setSuccess('Usuario creado'); setShowForm(false)
      setForm({ full_name:'', email:'', password:'', role:'student', plan_code:'basic' })
      loadUsers()
    } catch(e:any) { setError(e.message) }
  }

  const toggleUser = async (id: string, active: boolean) => {
    await API(`/admin/users/${id}/toggle`, { method:'POST', body:JSON.stringify({ is_active: !active }) })
    loadUsers()
  }

  const approvePayment = async (id: string) => {
    await API(`/admin/payments/${id}/approve`, { method:'POST' })
    setSuccess('Pago aprobado y plan activado')
    loadPayments(); loadUsers()
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    pending: payments.filter(p => p.status === 'pending').length,
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key:'overview',  label:'Resumen',       icon:'📊' },
    { key:'students',  label:'Alumnos',       icon:'🎓' },
    { key:'teachers',  label:'Docentes',      icon:'👨‍🏫' },
    { key:'import',    label:'Carga masiva',  icon:'📂' },
    { key:'payments',  label:'Pagos',         icon:'💳' },
    { key:'plans',     label:'Planes',        icon:'📋' },
  ]

  const PLANS_DATA = [
    { code:'basic',   name:'Básico',  inst:6000,  student:8000,  helps:1, diff:'Normal',                    color:'#60a5fa', features:['245 preguntas','1 ayuda IA','Reporte básico'] },
    { code:'plus',    name:'Plus',    inst:8000,  student:12000, helps:3, diff:'Normal + Difícil',          color:'#a78bfa', features:['3 ayudas IA','Pizarra acrílica','Reporte docente','Correo automático'] },
    { code:'premium', name:'Premium', inst:12000, student:15000, helps:5, diff:'Normal + Difícil + Reto',   color:'#34d399', features:['5 ayudas IA','WhatsApp','Reporte institucional','Ranking alumnos'] },
  ]

  return (
    <div style={{ background:'#040813', minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        .atab { padding:8px 14px;border-radius:9px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:all 0.15s;background:transparent;color:#475569;font-family:inherit;display:flex;align-items:center;gap:7px;width:100%;text-align:left; }
        .atab.active { background:rgba(37,99,235,0.12);border-color:rgba(37,99,235,0.3);color:#60a5fa; }
        .atab:hover:not(.active) { background:rgba(255,255,255,0.04);color:#94a3b8; }
        .abtn { padding:8px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .abtn-blue { background:#2563eb;border:none;color:#fff; }
        .abtn-blue:hover { background:#1d4ed8; }
        .abtn-red { background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171; }
        .abtn-green { background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);color:#34d399; }
        .abtn-ghost { background:transparent;border:1px solid rgba(255,255,255,0.1);color:#64748b; }
        .acard { background:rgba(12,18,38,0.8);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px; }
        .afield { width:100%;padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;font-size:13px;outline:none;font-family:inherit; }
        .afield:focus { border-color:rgba(37,99,235,0.4); }
        select.afield option { background:#0d1230; }
        .abadge { padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600; }
        .bg { background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2); }
        .br { background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2); }
        .by { background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2); }
        .bb { background:rgba(37,99,235,0.1);color:#60a5fa;border:1px solid rgba(37,99,235,0.2); }
        .bp { background:rgba(124,58,237,0.1);color:#a78bfa;border:1px solid rgba(124,58,237,0.2); }
        table { width:100%;border-collapse:collapse; }
        th { font-size:10px;font-weight:600;color:#475569;letter-spacing:0.5px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:left; }
        td { font-size:12px;color:#94a3b8;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04); }
        tr:hover td { background:rgba(255,255,255,0.02); }
        @media(max-width:768px){ .aside{ display:none!important; } }
      `}</style>

      {/* TOPBAR */}
      <div style={{ background:'rgba(4,8,19,0.97)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 20px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🧠</div>
          <span style={{ fontSize:13,fontWeight:700,color:'#e2e8f0' }}>ERP ICFES Neuro-IA</span>
          <span style={{ fontSize:10,color:'#ef4444',background:'rgba(239,68,68,0.1)',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(239,68,68,0.2)' }}>⚙ Admin</span>
        </div>
        {stats.pending > 0 && (
          <div onClick={()=>setTab('payments')} style={{ fontSize:11,color:'#fbbf24',background:'rgba(251,191,36,0.08)',padding:'5px 12px',borderRadius:20,border:'1px solid rgba(251,191,36,0.2)',cursor:'pointer' }}>
            ⚠ {stats.pending} pago{stats.pending>1?'s':''} pendiente{stats.pending>1?'s':''}
          </div>
        )}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)' }}>

        {/* SIDEBAR */}
        <div className="aside" style={{ background:'rgba(6,10,20,0.8)',borderRight:'1px solid rgba(255,255,255,0.05)',padding:14,display:'flex',flexDirection:'column',gap:3 }}>
          <div style={{ fontSize:10,color:'#334155',fontWeight:600,letterSpacing:1,marginBottom:8,padding:'0 6px' }}>NAVEGACIÓN</div>
          {TABS.map(t => (
            <button key={t.key} className={`atab ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              {t.label}
              {t.key==='payments' && stats.pending>0 && (
                <span style={{ marginLeft:'auto',background:'#ef4444',color:'#fff',borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700 }}>{stats.pending}</span>
              )}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ padding:20,overflowY:'auto' }}>
          {success && <div style={{ background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#34d399',marginBottom:14 }}>✓ {success}</div>}
          {error   && <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#f87171',marginBottom:14 }}>⚠ {error}</div>}

          {/* OVERVIEW */}
          {tab==='overview' && (
            <div>
              <div style={{ fontSize:18,fontWeight:700,color:'#f1f5f9',marginBottom:20 }}>Panel Administrador</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:20 }}>
                {[
                  { label:'Total usuarios',   val:stats.total,   color:'#60a5fa' },
                  { label:'Activos',           val:stats.active,  color:'#34d399' },
                  { label:'Estudiantes',       val:stats.students,color:'#a78bfa' },
                  { label:'Docentes',          val:stats.teachers,color:'#fbbf24' },
                  { label:'Pagos pendientes',  val:stats.pending, color:'#f87171' },
                ].map(s => (
                  <div key={s.label} className="acard" style={{ textAlign:'center' }}>
                    <div style={{ fontSize:28,fontWeight:700,color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:11,color:'#475569',marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="acard">
                <div style={{ fontSize:12,fontWeight:600,color:'#94a3b8',marginBottom:12 }}>Últimos usuarios</div>
                <table>
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Plan</th><th>Estado</th></tr></thead>
                  <tbody>
                    {users.slice(0,8).map(u => (
                      <tr key={u.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td><span className={`abadge ${u.role==='admin'?'br':u.role==='teacher'?'by':'bb'}`}>{u.role}</span></td>
                        <td><span className={`abadge ${u.plan_code==='premium'?'bg':u.plan_code==='plus'?'bp':'bb'}`}>{u.plan_code||'basic'}</span></td>
                        <td><span className={`abadge ${u.is_active?'bg':'br'}`}>{u.is_active?'Activo':'Inactivo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STUDENTS / TEACHERS */}
          {(tab==='students'||tab==='teachers') && (
            <div>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8 }}>
                <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9' }}>{tab==='students'?'Gestión de Alumnos':'Gestión de Docentes'}</div>
                <div style={{ display:'flex',gap:8 }}>
                  <button className="abtn abtn-ghost" onClick={()=>setTab('import')}>📂 Carga masiva</button>
                  <button className="abtn abtn-blue" onClick={()=>{ setShowForm(true); setForm({...form,role:tab==='students'?'student':'teacher'}) }}>+ Agregar</button>
                </div>
              </div>

              {showForm && (
                <div className="acard" style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#e2e8f0',marginBottom:14 }}>Nuevo usuario</div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>NOMBRE COMPLETO</div>
                      <input className="afield" placeholder="Juan Pérez García" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>CORREO</div>
                      <input className="afield" type="email" placeholder="juan@colegio.edu.co" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>CONTRASEÑA INICIAL</div>
                      <input className="afield" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>PLAN</div>
                      <select className="afield" value={form.plan_code} onChange={e=>setForm({...form,plan_code:e.target.value})}>
                        <option value="basic">Básico — $6.000 inst / $8.000 est</option>
                        <option value="plus">Plus — $8.000 inst / $12.000 est</option>
                        <option value="premium">Premium — $12.000 inst / $15.000 est</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    <button className="abtn abtn-blue" onClick={createUser}>Guardar</button>
                    <button className="abtn abtn-ghost" onClick={()=>setShowForm(false)}>Cancelar</button>
                  </div>
                  <div style={{ fontSize:11,color:'#334155',marginTop:8 }}>💡 El estudiante puede cambiar su contraseña después del primer ingreso.</div>
                </div>
              )}

              <div className="acard">
                <table>
                  <thead><tr><th>Nombre</th><th>Email</th><th>Plan</th><th>Estado</th><th>Registro</th><th>Acción</th></tr></thead>
                  <tbody>
                    {users.filter(u => tab==='students'?u.role==='student':u.role==='teacher').map(u => (
                      <tr key={u.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td><span className={`abadge ${u.plan_code==='premium'?'bg':u.plan_code==='plus'?'bp':'bb'}`}>{u.plan_code||'basic'}</span></td>
                        <td><span className={`abadge ${u.is_active?'bg':'br'}`}>{u.is_active?'Activo':'Inactivo'}</span></td>
                        <td style={{ fontSize:11 }}>{new Date(u.created_at).toLocaleDateString('es-CO')}</td>
                        <td>
                          <button className={`abtn ${u.is_active?'abtn-red':'abtn-green'}`} onClick={()=>toggleUser(u.id,u.is_active)}>
                            {u.is_active?'Desactivar':'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.filter(u=>tab==='students'?u.role==='student':u.role==='teacher').length===0 && (
                      <tr><td colSpan={6} style={{ textAlign:'center',padding:24,color:'#334155' }}>No hay {tab==='students'?'alumnos':'docentes'} registrados</td></tr>
                    )}
                  </tbody>
                </table>
                {loading && <div style={{ textAlign:'center',padding:16,color:'#475569',fontSize:12 }}>Cargando...</div>}
              </div>
            </div>
          )}

          {/* IMPORT */}
          {tab==='import' && (
            <div>
              <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9',marginBottom:16 }}>Carga Masiva de Usuarios</div>
              <div className="acard">
                <ImportStudents onImported={()=>{ loadUsers(); setSuccess('Usuarios importados correctamente') }} />
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {tab==='payments' && (
            <div>
              <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9',marginBottom:16 }}>Gestión de Pagos — Nequi</div>
              <div style={{ background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:10,padding:12,marginBottom:16,fontSize:12,color:'#fbbf24' }}>
                📱 El estudiante paga por Nequi, registra la referencia y el administrador aprueba aquí para activar el plan.
              </div>
              <div className="acard">
                <table>
                  <thead><tr><th>Estudiante</th><th>Plan</th><th>Valor</th><th>Ref. Nequi</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
                  <tbody>
                    {payments.length===0 && <tr><td colSpan={7} style={{ textAlign:'center',padding:24,color:'#334155' }}>No hay pagos registrados</td></tr>}
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{p.student_name}</td>
                        <td><span className={`abadge ${p.plan==='premium'?'bg':p.plan==='plus'?'bp':'bb'}`}>{p.plan}</span></td>
                        <td style={{ color:'#34d399',fontWeight:600 }}>${p.amount?.toLocaleString()}</td>
                        <td style={{ fontFamily:'monospace',color:'#a78bfa',fontSize:11 }}>{p.nequi_ref}</td>
                        <td style={{ fontSize:11 }}>{new Date(p.created_at).toLocaleDateString('es-CO')}</td>
                        <td><span className={`abadge ${p.status==='approved'?'bg':p.status==='pending'?'by':'br'}`}>{p.status==='approved'?'Aprobado':p.status==='pending'?'Pendiente':'Rechazado'}</span></td>
                        <td>
                          {p.status==='pending' && (
                            <button className="abtn abtn-green" onClick={()=>approvePayment(p.id)}>✓ Aprobar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PLANS */}
          {tab==='plans' && (
            <div>
              <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9',marginBottom:16 }}>Planes Comerciales</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12 }}>
                {PLANS_DATA.map(p => (
                  <div key={p.code} className="acard" style={{ border:`1px solid ${p.color}25` }}>
                    <div style={{ fontSize:10,fontWeight:700,color:p.color,letterSpacing:1,marginBottom:10 }}>{p.name.toUpperCase()}</div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10,color:'#475569',marginBottom:2 }}>Institución</div>
                      <div style={{ fontSize:20,fontWeight:700,color:'#e2e8f0' }}>${p.inst.toLocaleString()} <span style={{ fontSize:10,color:'#475569' }}>COP/est.</span></div>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10,color:'#475569',marginBottom:2 }}>Estudiante individual</div>
                      <div style={{ fontSize:16,fontWeight:700,color:'#e2e8f0' }}>${p.student.toLocaleString()} <span style={{ fontSize:10,color:'#475569' }}>COP</span></div>
                    </div>
                    <div style={{ background:`${p.color}10`,border:`1px solid ${p.color}20`,borderRadius:7,padding:'5px 10px',marginBottom:10,fontSize:11,color:p.color }}>
                      🎯 {p.diff}
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4,marginBottom:12 }}>
                      {p.features.map(f => (
                        <div key={f} style={{ display:'flex',gap:6,alignItems:'center' }}>
                          <span style={{ color:p.color,fontSize:10 }}>✓</span>
                          <span style={{ fontSize:11,color:'#64748b' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.05)',fontSize:11,color:'#475569' }}>
                      45 alumnos = <span style={{ color:p.color,fontWeight:600 }}>${(p.inst*45).toLocaleString()} COP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
