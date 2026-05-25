// frontend/src/features/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react'

interface Student { id: string; full_name: string; email: string; role: string; is_active: boolean; plan_code: string; created_at: string }
interface Payment { id: string; student_name: string; plan: string; amount: number; nequi_ref: string; status: string; created_at: string }

type Tab = 'overview' | 'students' | 'teachers' | 'payments' | 'plans'

const API = (path: string, opts?: RequestInit) =>
  fetch(`/api/v1${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, ...opts?.headers }
  }).then(r => r.json())

export default function AdminDashboard() {
  const [tab,      setTab]      = useState<Tab>('overview')
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ full_name:'', email:'', password:'', role:'student', plan_code:'basic' })
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  useEffect(() => { loadStudents(); loadPayments() }, [])

  const loadStudents = async () => {
    setLoading(true)
    try {
      const data = await API('/admin/users')
      setStudents(data.users || [])
    } catch {}
    setLoading(false)
  }

  const loadPayments = async () => {
    try {
      const data = await API('/admin/payments')
      setPayments(data.payments || [])
    } catch {}
  }

  const createUser = async () => {
    setError(''); setSuccess('')
    if (!form.full_name || !form.email || !form.password) { setError('Completa todos los campos'); return }
    try {
      const data = await API('/admin/users', { method: 'POST', body: JSON.stringify(form) })
      if (data.error) throw new Error(data.error)
      setSuccess('Usuario creado correctamente')
      setShowForm(false)
      setForm({ full_name:'', email:'', password:'', role:'student', plan_code:'basic' })
      loadStudents()
    } catch (e: any) { setError(e.message) }
  }

  const toggleUser = async (id: string, active: boolean) => {
    await API(`/admin/users/${id}/toggle`, { method: 'POST', body: JSON.stringify({ is_active: !active }) })
    loadStudents()
  }

  const approvePayment = async (id: string) => {
    await API(`/admin/payments/${id}/approve`, { method: 'POST' })
    setSuccess('Pago aprobado y plan activado')
    loadPayments(); loadStudents()
  }

  const stats = {
    total: students.length,
    active: students.filter(s => s.is_active).length,
    students: students.filter(s => s.role === 'student').length,
    teachers: students.filter(s => s.role === 'teacher').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key:'overview',  label:'Resumen',    icon:'📊' },
    { key:'students',  label:'Alumnos',    icon:'🎓' },
    { key:'teachers',  label:'Docentes',   icon:'👨‍🏫' },
    { key:'payments',  label:'Pagos',      icon:'💳' },
    { key:'plans',     label:'Planes',     icon:'📋' },
  ]

  const ROLES = ['student','teacher','institution','admin']
  const PLANS = ['basic','plus','premium']

  return (
    <div style={{ background:'#040813', minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .tab-item { padding:8px 16px;border-radius:9px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:all 0.15s;background:transparent;color:#475569;font-family:inherit; }
        .tab-item.active { background:rgba(37,99,235,0.12);border-color:rgba(37,99,235,0.3);color:#60a5fa; }
        .tab-item:hover:not(.active) { background:rgba(255,255,255,0.04);color:#94a3b8; }
        .btn { padding:8px 16px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:inherit; }
        .btn-primary { background:#2563eb;color:#fff; }
        .btn-primary:hover { background:#1d4ed8; }
        .btn-danger { background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2); }
        .btn-success { background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2); }
        .btn-warning { background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2); }
        .card { background:rgba(12,18,38,0.8);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px; }
        .field { width:100%;padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#e2e8f0;font-size:13px;outline:none;font-family:inherit; }
        .field:focus { border-color:rgba(37,99,235,0.4); }
        select.field option { background:#0d1230; }
        .badge { padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600; }
        .badge-green { background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2); }
        .badge-red { background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2); }
        .badge-yellow { background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2); }
        .badge-blue { background:rgba(37,99,235,0.1);color:#60a5fa;border:1px solid rgba(37,99,235,0.2); }
        table { width:100%;border-collapse:collapse; }
        th { font-size:10px;font-weight:600;color:#475569;letter-spacing:0.5px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:left; }
        td { font-size:12px;color:#94a3b8;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04); }
        tr:hover td { background:rgba(255,255,255,0.02); }
        @media(max-width:768px) { .hide-mobile { display:none!important; } }
      `}</style>

      {/* TOPBAR */}
      <div style={{ background:'rgba(4,8,19,0.97)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 20px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🧠</div>
          <span style={{ fontSize:13,fontWeight:700,color:'#e2e8f0' }}>ERP ICFES Neuro-IA</span>
          <span style={{ fontSize:10,color:'#ef4444',background:'rgba(239,68,68,0.1)',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(239,68,68,0.2)' }}>Admin</span>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {payments.filter(p=>p.status==='pending').length > 0 && (
            <div style={{ fontSize:11,color:'#fbbf24',background:'rgba(251,191,36,0.1)',padding:'4px 10px',borderRadius:20,border:'1px solid rgba(251,191,36,0.2)',cursor:'pointer' }} onClick={()=>setTab('payments')}>
              ⚠ {payments.filter(p=>p.status==='pending').length} pagos pendientes
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'calc(100vh - 52px)' }}>

        {/* SIDEBAR */}
        <div style={{ background:'rgba(6,10,20,0.8)',borderRight:'1px solid rgba(255,255,255,0.05)',padding:16,display:'flex',flexDirection:'column',gap:4 }} className="hide-mobile">
          <div style={{ fontSize:10,color:'#334155',fontWeight:600,letterSpacing:1,marginBottom:8,padding:'0 8px' }}>NAVEGACIÓN</div>
          {TABS.map(t => (
            <button key={t.key} className={`tab-item ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)} style={{ display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left' }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>{t.label}
              {t.key==='payments' && payments.filter(p=>p.status==='pending').length>0 && (
                <span style={{ marginLeft:'auto',background:'#ef4444',color:'#fff',borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700 }}>
                  {payments.filter(p=>p.status==='pending').length}
                </span>
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
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:20 }}>
                {[
                  { label:'Total usuarios', val:stats.total,           color:'#60a5fa' },
                  { label:'Activos',         val:stats.active,          color:'#34d399' },
                  { label:'Estudiantes',     val:stats.students,        color:'#a78bfa' },
                  { label:'Docentes',        val:stats.teachers,        color:'#fbbf24' },
                  { label:'Pagos pendientes',val:stats.pendingPayments, color:'#f87171' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ textAlign:'center' }}>
                    <div style={{ fontSize:28,fontWeight:700,color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:11,color:'#475569',marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ fontSize:12,fontWeight:600,color:'#94a3b8',marginBottom:12 }}>Últimos usuarios registrados</div>
                <table>
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
                  <tbody>
                    {students.slice(0,5).map(s => (
                      <tr key={s.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td><span className={`badge badge-${s.role==='admin'?'red':s.role==='teacher'?'yellow':'blue'}`}>{s.role}</span></td>
                        <td><span className={`badge ${s.is_active?'badge-green':'badge-red'}`}>{s.is_active?'Activo':'Inactivo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STUDENTS & TEACHERS */}
          {(tab==='students' || tab==='teachers') && (
            <div>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
                <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9' }}>{tab==='students'?'Gestión de Alumnos':'Gestión de Docentes'}</div>
                <button className="btn btn-primary" onClick={()=>{ setShowForm(true); setForm({...form, role: tab==='students'?'student':'teacher'}) }}>
                  + Agregar {tab==='students'?'alumno':'docente'}
                </button>
              </div>

              {showForm && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#e2e8f0',marginBottom:14 }}>Nuevo usuario</div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>NOMBRE COMPLETO</div>
                      <input className="field" placeholder="Juan Pérez" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>CORREO</div>
                      <input className="field" type="email" placeholder="juan@colegio.edu.co" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>CONTRASEÑA</div>
                      <input className="field" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
                    </div>
                    <div>
                      <div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>PLAN</div>
                      <select className="field" value={form.plan_code} onChange={e=>setForm({...form,plan_code:e.target.value})}>
                        <option value="basic">Básico — $6.000</option>
                        <option value="plus">Plus — $8.000</option>
                        <option value="premium">Premium — $12.000</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    <button className="btn btn-primary" onClick={createUser}>Guardar</button>
                    <button className="btn" style={{ background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#64748b' }} onClick={()=>setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              <div className="card">
                <table>
                  <thead><tr><th>Nombre</th><th>Email</th><th>Plan</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {students.filter(s => tab==='students' ? s.role==='student' : s.role==='teacher').map(s => (
                      <tr key={s.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td><span className={`badge ${s.plan_code==='premium'?'badge-yellow':s.plan_code==='plus'?'badge-blue':'badge-green'}`}>{s.plan_code}</span></td>
                        <td><span className={`badge ${s.is_active?'badge-green':'badge-red'}`}>{s.is_active?'Activo':'Inactivo'}</span></td>
                        <td>
                          <button className={`btn ${s.is_active?'btn-danger':'btn-success'}`} onClick={()=>toggleUser(s.id, s.is_active)}>
                            {s.is_active?'Desactivar':'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loading && <div style={{ textAlign:'center',padding:20,color:'#475569',fontSize:12 }}>Cargando...</div>}
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {tab==='payments' && (
            <div>
              <div style={{ fontSize:16,fontWeight:700,color:'#f1f5f9',marginBottom:16 }}>Gestión de Pagos — Nequi</div>
              <div style={{ background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:10,padding:12,marginBottom:16,fontSize:12,color:'#fbbf24' }}>
                📱 Los pagos se realizan a Nequi. El estudiante envía el comprobante y el administrador aprueba manualmente para activar el plan.
              </div>
              <div className="card">
                <table>
                  <thead><tr><th>Estudiante</th><th>Plan</th><th>Valor</th><th>Ref. Nequi</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
                  <tbody>
                    {payments.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign:'center',padding:20,color:'#334155' }}>No hay pagos registrados</td></tr>
                    )}
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ color:'#e2e8f0',fontWeight:500 }}>{p.student_name}</td>
                        <td><span className={`badge ${p.plan==='premium'?'badge-yellow':p.plan==='plus'?'badge-blue':'badge-green'}`}>{p.plan}</span></td>
                        <td style={{ color:'#34d399',fontWeight:600 }}>${p.amount.toLocaleString()}</td>
                        <td style={{ fontFamily:'monospace',color:'#a78bfa' }}>{p.nequi_ref}</td>
                        <td>{new Date(p.created_at).toLocaleDateString('es-CO')}</td>
                        <td><span className={`badge ${p.status==='approved'?'badge-green':p.status==='pending'?'badge-yellow':'badge-red'}`}>{p.status==='approved'?'Aprobado':p.status==='pending'?'Pendiente':'Rechazado'}</span></td>
                        <td>
                          {p.status==='pending' && (
                            <div style={{ display:'flex',gap:6 }}>
                              <button className="btn btn-success" onClick={()=>approvePayment(p.id)}>✓ Aprobar</button>
                            </div>
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
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12 }}>
                {[
                  { name:'Básico', code:'basic', inst:6000, student:8000, helps:1, diff:'Normal', color:'#60a5fa', features:['245 preguntas','Calificación automática','1 ayuda IA','Reporte básico'] },
                  { name:'Plus', code:'plus', inst:8000, student:12000, helps:3, diff:'Normal + Difícil', color:'#a78bfa', features:['Todo Básico','3 ayudas IA','Pizarra acrílica','Reporte docente','Correo automático'] },
                  { name:'Premium', code:'premium', inst:12000, student:15000, helps:5, diff:'Normal + Difícil + Muy difícil', color:'#34d399', features:['Todo Plus','5 ayudas IA','WhatsApp automático','Reporte institucional','Ranking alumnos','Alumnos en riesgo'] },
                ].map(p => (
                  <div key={p.code} className="card" style={{ border:`1px solid ${p.color}30` }}>
                    <div style={{ fontSize:11,fontWeight:700,color:p.color,letterSpacing:1,marginBottom:8 }}>{p.name.toUpperCase()}</div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11,color:'#475569',marginBottom:4 }}>Institución</div>
                      <div style={{ fontSize:22,fontWeight:700,color:'#e2e8f0' }}>${p.inst.toLocaleString()} <span style={{ fontSize:11,fontWeight:400,color:'#475569' }}>COP/est.</span></div>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11,color:'#475569',marginBottom:4 }}>Estudiante individual</div>
                      <div style={{ fontSize:18,fontWeight:700,color:'#e2e8f0' }}>${p.student.toLocaleString()} <span style={{ fontSize:11,fontWeight:400,color:'#475569' }}>COP</span></div>
                    </div>
                    <div style={{ background:`${p.color}10`,border:`1px solid ${p.color}20`,borderRadius:7,padding:'6px 10px',marginBottom:10,fontSize:11,color:p.color }}>
                      🎯 Dificultad: {p.diff}
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                      {p.features.map(f => (
                        <div key={f} style={{ display:'flex',gap:6,alignItems:'center' }}>
                          <span style={{ color:p.color,fontSize:10 }}>✓</span>
                          <span style={{ fontSize:11,color:'#64748b' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop:12,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.05)',fontSize:11,color:'#475569' }}>
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
