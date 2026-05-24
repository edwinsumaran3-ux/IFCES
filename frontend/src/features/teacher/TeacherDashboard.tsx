// =============================================================================
//  src/features/teacher/TeacherDashboard.tsx
//  Panel del docente en tiempo real — alertas, IA, mapa cognitivo
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Student {
  id: string; name: string; group: string;
  progress: number; score: number;
  aiHelpsUsed: number; aiHelpsMax: number;
  status: 'active' | 'idle' | 'finished' | 'risk';
  areas: Record<string, number>;
  lastQuestion: number; totalQuestions: number;
  mirrorSuccessRate: number; helpDependency: number;
  cognitiveStress: number; concentration: number;
}

interface Alert {
  id: string; studentId: string; studentName: string;
  type: 'ai_limit' | 'low_score' | 'high_dependency' | 'cognitive_stress' | 'idle';
  message: string; severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

// ── Datos demo ────────────────────────────────────────────────────────────────
const DEMO_STUDENTS: Student[] = [
  { id:'s1', name:'Isabella Torres',   group:'11-B', progress:68, score:72, aiHelpsUsed:3, aiHelpsMax:5, status:'active',   areas:{Matemáticas:64,Lectura:78,Ciencias:55,Inglés:71}, lastQuestion:14, totalQuestions:45, mirrorSuccessRate:67, helpDependency:43, cognitiveStress:62, concentration:84 },
  { id:'s2', name:'Carlos Mendoza',    group:'11-B', progress:82, score:85, aiHelpsUsed:1, aiHelpsMax:5, status:'active',   areas:{Matemáticas:88,Lectura:82,Ciencias:79,Inglés:76}, lastQuestion:18, totalQuestions:45, mirrorSuccessRate:100,helpDependency:12, cognitiveStress:28, concentration:91 },
  { id:'s3', name:'Valentina Ríos',    group:'11-B', progress:45, score:48, aiHelpsUsed:5, aiHelpsMax:5, status:'risk',     areas:{Matemáticas:42,Lectura:55,Ciencias:38,Inglés:48}, lastQuestion:10, totalQuestions:45, mirrorSuccessRate:20, helpDependency:95, cognitiveStress:88, concentration:42 },
  { id:'s4', name:'Sebastián Castro',  group:'11-B', progress:71, score:69, aiHelpsUsed:2, aiHelpsMax:5, status:'active',   areas:{Matemáticas:71,Lectura:74,Ciencias:63,Inglés:65}, lastQuestion:15, totalQuestions:45, mirrorSuccessRate:50, helpDependency:28, cognitiveStress:45, concentration:78 },
  { id:'s5', name:'Daniela Vargas',    group:'11-B', progress:90, score:91, aiHelpsUsed:0, aiHelpsMax:5, status:'active',   areas:{Matemáticas:92,Lectura:90,Ciencias:88,Inglés:85}, lastQuestion:20, totalQuestions:45, mirrorSuccessRate:0,  helpDependency:0,  cognitiveStress:18, concentration:96 },
  { id:'s6', name:'Andrés Morales',    group:'11-B', progress:33, score:41, aiHelpsUsed:4, aiHelpsMax:5, status:'risk',     areas:{Matemáticas:38,Lectura:48,Ciencias:30,Inglés:44}, lastQuestion:7,  totalQuestions:45, mirrorSuccessRate:25, helpDependency:82, cognitiveStress:79, concentration:51 },
  { id:'s7', name:'Camila Jiménez',    group:'11-B', progress:60, score:63, aiHelpsUsed:2, aiHelpsMax:5, status:'idle',     areas:{Matemáticas:60,Lectura:68,Ciencias:58,Inglés:62}, lastQuestion:13, totalQuestions:45, mirrorSuccessRate:50, helpDependency:31, cognitiveStress:50, concentration:70 },
  { id:'s8', name:'Felipe Gutiérrez',  group:'11-B', progress:55, score:57, aiHelpsUsed:3, aiHelpsMax:5, status:'active',   areas:{Matemáticas:52,Lectura:62,Ciencias:50,Inglés:55}, lastQuestion:12, totalQuestions:45, mirrorSuccessRate:33, helpDependency:56, cognitiveStress:65, concentration:68 },
];

const DEMO_ALERTS: Alert[] = [
  { id:'a1', studentId:'s3', studentName:'Valentina Ríos',   type:'ai_limit',       message:'Agotó las 5 ayudas IA. Puntaje en riesgo.',           severity:'critical', timestamp:'10:42 AM' },
  { id:'a2', studentId:'s6', studentName:'Andrés Morales',   type:'high_dependency',message:'Dependencia IA >80%. 4/5 ayudas usadas.',             severity:'critical', timestamp:'10:38 AM' },
  { id:'a3', studentId:'s3', studentName:'Valentina Ríos',   type:'cognitive_stress',message:'Estrés cognitivo alto (88%). Posible bloqueo.',       severity:'warning',  timestamp:'10:35 AM' },
  { id:'a4', studentId:'s8', studentName:'Felipe Gutiérrez', type:'high_dependency',message:'Tasa espejo: 33%. Comprensión socrática limitada.',    severity:'warning',  timestamp:'10:30 AM' },
  { id:'a5', studentId:'s7', studentName:'Camila Jiménez',   type:'idle',           message:'Sin actividad en los últimos 8 minutos.',              severity:'info',     timestamp:'10:28 AM' },
];

const AREAS = ['Matemáticas','Lectura','Ciencias','Inglés'];
const AREA_COLORS: Record<string,string> = { Matemáticas:'#00d4ff', Lectura:'#10b981', Ciencias:'#f59e0b', Inglés:'#a78bfa' };

// ── Componente principal ──────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const [students,       ] = useState<Student[]>(DEMO_STUDENTS);
  const [alerts,         ] = useState<Alert[]>(DEMO_ALERTS);
  const [selectedStudent, setSelected] = useState<Student | null>(null);
  const [tab,            setTab]       = useState<'overview'|'ai'|'cognitive'|'alerts'>('overview');
  const [dismissedAlerts, setDismissed]= useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket para datos en tiempo real (conectar cuando esté en producción)
  useEffect(() => {
    // wsRef.current = new WebSocket('ws://localhost:8000/ws/teacher');
    // wsRef.current.onmessage = (e) => { /* actualizar estado */ };
    return () => wsRef.current?.close();
  }, []);

  const activeAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  const riskStudents = students.filter(s => s.status === 'risk');
  const avgScore     = Math.round(students.reduce((a,s) => a + s.score, 0) / students.length);
  const totalAIHelps = students.reduce((a,s) => a + s.aiHelpsUsed, 0);

  return (
    <div style={S.shell}>

      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={S.brand}>
          <span style={{fontSize:18,color:'#00d4ff'}}>🧠</span>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:'#e2e8f0'}}>Panel Docente — Tiempo Real</div>
            <div style={{fontSize:10,color:'#475569'}}>Simulacro Nacional · Grado 11-B · {students.length} estudiantes</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={S.pill('#34d399','rgba(16,185,129,0.1)')}>● En vivo</span>
          <span style={S.pill('#f87171','rgba(239,68,68,0.1)')}>⚠ {activeAlerts.length} alertas</span>
          <span style={S.pill('#fbbf24','rgba(245,158,11,0.1)')}>🤖 {totalAIHelps} ayudas IA usadas</span>
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabs}>
        {(['overview','ai','cognitive','alerts'] as const).map(t => (
          <button key={t} style={{...S.tab, ...(tab===t?S.tabAct:{})}} onClick={()=>setTab(t)}>
            {t==='overview'?'Resumen general':t==='ai'?'Uso de IA':t==='cognitive'?'Perfil cognitivo':'Alertas'}
            {t==='alerts' && activeAlerts.length > 0 && (
              <span style={S.alertCount}>{activeAlerts.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={S.body}>
        <div style={S.main}>

          {/* ── TAB OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              {/* KPIs */}
              <div style={S.kpiRow}>
                {[
                  { label:'Puntaje promedio', val:`${avgScore} pts`,       color:'#00d4ff' },
                  { label:'En riesgo',        val:`${riskStudents.length}`, color:'#f87171' },
                  { label:'Terminaron',       val:students.filter(s=>s.status==='finished').length.toString(), color:'#34d399' },
                  { label:'Ayudas IA totales',val:totalAIHelps.toString(),  color:'#fbbf24' },
                ].map(k=>(
                  <div key={k.label} style={S.kpi}>
                    <div style={{fontSize:10,color:'#475569',marginBottom:4}}>{k.label}</div>
                    <div style={{fontSize:22,fontWeight:500,color:k.color}}>{k.val}</div>
                  </div>
                ))}
              </div>

              {/* Tabla de estudiantes */}
              <div style={S.tableCard}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:12,fontWeight:500,color:'#e2e8f0'}}>Estudiantes del grupo</span>
                  <span style={{fontSize:10,color:'#334155'}}>Actualización en tiempo real</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:'0.5px solid rgba(255,255,255,0.06)'}}>
                      {['Estudiante','Progreso','Puntaje','Ayudas IA','Dep. IA','Estado'].map(h=>(
                        <th key={h} style={{padding:'7px 10px',color:'#334155',textAlign:'left',fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s,i)=>(
                      <tr
                        key={s.id}
                        style={{
                          borderBottom:'0.5px solid rgba(255,255,255,0.04)',
                          background: selectedStudent?.id===s.id ? 'rgba(0,212,255,0.04)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          cursor:'pointer',
                        }}
                        onClick={()=>setSelected(s===selectedStudent?null:s)}
                      >
                        <td style={{padding:'8px 10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            <div style={{...S.avatar, background: s.status==='risk'?'rgba(239,68,68,0.15)':'rgba(0,212,255,0.08)', color:s.status==='risk'?'#f87171':'#00d4ff'}}>
                              {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                            </div>
                            <div>
                              <div style={{color:'#e2e8f0',fontWeight:500}}>{s.name}</div>
                              <div style={{fontSize:9,color:'#334155'}}>{s.group}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div style={{width:60,height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${s.progress}%`,background:'#00d4ff',borderRadius:2}}/>
                            </div>
                            <span style={{color:'#64748b'}}>{s.progress}%</span>
                          </div>
                        </td>
                        <td style={{padding:'8px 10px',fontWeight:500,color:s.score>=70?'#34d399':s.score>=50?'#fbbf24':'#f87171'}}>{s.score}</td>
                        <td style={{padding:'8px 10px'}}>
                          <div style={{display:'flex',gap:3}}>
                            {Array.from({length:5}).map((_,j)=>(
                              <div key={j} style={{width:8,height:8,borderRadius:'50%',background:j<s.aiHelpsUsed?'#f59e0b':'rgba(255,255,255,0.08)'}}/>
                            ))}
                          </div>
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{width:40,height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${s.helpDependency}%`,background:s.helpDependency>70?'#ef4444':s.helpDependency>40?'#f59e0b':'#10b981',borderRadius:2}}/>
                            </div>
                            <span style={{fontSize:10,color:'#64748b'}}>{s.helpDependency}%</span>
                          </div>
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          <span style={{...S.statusBadge, ...(
                            s.status==='risk'?{background:'rgba(239,68,68,0.15)',color:'#f87171',border:'0.5px solid rgba(239,68,68,0.3)'}:
                            s.status==='active'?{background:'rgba(16,185,129,0.1)',color:'#34d399',border:'0.5px solid rgba(16,185,129,0.2)'}:
                            s.status==='idle'?{background:'rgba(245,158,11,0.1)',color:'#fbbf24',border:'0.5px solid rgba(245,158,11,0.2)'}:
                            {background:'rgba(71,85,105,0.2)',color:'#64748b',border:'0.5px solid rgba(71,85,105,0.3)'}
                          )}}>
                            {s.status==='risk'?'⚠ Riesgo':s.status==='active'?'● Activo':s.status==='idle'?'⏸ Inactivo':'✓ Terminó'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── TAB USO DE IA ── */}
          {tab === 'ai' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={S.kpiRow}>
                {[
                  { label:'Ayudas usadas',        val:totalAIHelps,                                           color:'#fbbf24' },
                  { label:'Tasa espejo exitosa',   val:`${Math.round(students.reduce((a,s)=>a+s.mirrorSuccessRate,0)/students.length)}%`, color:'#34d399' },
                  { label:'Dependencia promedio',  val:`${Math.round(students.reduce((a,s)=>a+s.helpDependency,0)/students.length)}%`,    color:'#f87171' },
                  { label:'Estudiantes en riesgo', val:riskStudents.length,                                   color:'#ef4444' },
                ].map(k=>(
                  <div key={k.label} style={S.kpi}>
                    <div style={{fontSize:10,color:'#475569',marginBottom:4}}>{k.label}</div>
                    <div style={{fontSize:22,fontWeight:500,color:k.color}}>{k.val}</div>
                  </div>
                ))}
              </div>
              {students.map(s=>(
                <div key={s.id} style={S.aiStudentRow}>
                  <div style={{...S.avatar,background:'rgba(0,212,255,0.08)',color:'#00d4ff',flexShrink:0}}>
                    {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:12,fontWeight:500,color:'#e2e8f0'}}>{s.name}</span>
                      <span style={{fontSize:11,color:'#334155'}}>{s.aiHelpsUsed}/5 ayudas</span>
                    </div>
                    <div style={{display:'flex',gap:4,marginBottom:5}}>
                      {Array.from({length:5}).map((_,j)=>(
                        <div key={j} style={{flex:1,height:6,borderRadius:3,background:j<s.aiHelpsUsed?'#f59e0b':'rgba(255,255,255,0.06)'}}/>
                      ))}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      <div style={S.miniStat}>
                        <div style={{fontSize:9,color:'#334155'}}>Tasa espejo</div>
                        <div style={{fontSize:13,fontWeight:500,color:s.mirrorSuccessRate>60?'#34d399':s.mirrorSuccessRate>30?'#fbbf24':'#f87171'}}>{s.mirrorSuccessRate}%</div>
                      </div>
                      <div style={S.miniStat}>
                        <div style={{fontSize:9,color:'#334155'}}>Dep. IA</div>
                        <div style={{fontSize:13,fontWeight:500,color:s.helpDependency>70?'#f87171':s.helpDependency>40?'#fbbf24':'#34d399'}}>{s.helpDependency}%</div>
                      </div>
                      <div style={S.miniStat}>
                        <div style={{fontSize:9,color:'#334155'}}>Puntaje</div>
                        <div style={{fontSize:13,fontWeight:500,color:s.score>=70?'#34d399':s.score>=50?'#fbbf24':'#f87171'}}>{s.score}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB COGNITIVO ── */}
          {tab === 'cognitive' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:12,color:'#475569',marginBottom:4}}>Dominio por área — promedio del grupo</div>
              {AREAS.map(area=>{
                const avg = Math.round(students.reduce((a,s)=>a+(s.areas[area]||0),0)/students.length);
                return (
                  <div key={area} style={S.areaRow}>
                    <div style={{width:100,fontSize:11,color:'#94a3b8'}}>{area}</div>
                    <div style={{flex:1,height:8,background:'rgba(255,255,255,0.05)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${avg}%`,background:AREA_COLORS[area],borderRadius:4,transition:'width 0.8s ease'}}/>
                    </div>
                    <div style={{width:40,textAlign:'right',fontSize:11,fontWeight:500,color:AREA_COLORS[area]}}>{avg}%</div>
                    {avg < 55 && <span style={S.riskTag}>Brecha</span>}
                  </div>
                );
              })}
              <div style={{fontSize:12,color:'#475569',marginTop:8,marginBottom:4}}>Perfil individual</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                {students.map(s=>(
                  <div key={s.id} style={{...S.cogCard, borderColor:s.status==='risk'?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.06)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:500,color:'#e2e8f0'}}>{s.name}</span>
                      <span style={{fontSize:10,color:s.cognitiveStress>70?'#f87171':s.cognitiveStress>40?'#fbbf24':'#34d399'}}>
                        Estrés: {s.cognitiveStress}%
                      </span>
                    </div>
                    {AREAS.map(area=>(
                      <div key={area} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <div style={{width:55,fontSize:9,color:'#334155'}}>{area}</div>
                        <div style={{flex:1,height:4,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${s.areas[area]||0}%`,background:AREA_COLORS[area],borderRadius:2}}/>
                        </div>
                        <div style={{width:28,fontSize:9,textAlign:'right',color:'#475569'}}>{s.areas[area]||0}%</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB ALERTAS ── */}
          {tab === 'alerts' && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {activeAlerts.length === 0 && (
                <div style={{textAlign:'center',padding:'40px',color:'#334155',fontSize:13}}>
                  ✓ Sin alertas activas
                </div>
              )}
              {activeAlerts.map(alert=>(
                <div key={alert.id} style={{
                  ...S.alertCard,
                  borderLeftColor: alert.severity==='critical'?'#ef4444':alert.severity==='warning'?'#f59e0b':'#3b82f6',
                  background: alert.severity==='critical'?'rgba(239,68,68,0.05)':alert.severity==='warning'?'rgba(245,158,11,0.04)':'rgba(59,130,246,0.04)',
                }}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:500,color:alert.severity==='critical'?'#f87171':alert.severity==='warning'?'#fbbf24':'#60a5fa'}}>
                        {alert.severity==='critical'?'🔴':alert.severity==='warning'?'🟡':'🔵'} {alert.studentName}
                      </span>
                      <span style={{fontSize:9,color:'#334155'}}>{alert.timestamp}</span>
                    </div>
                    <div style={{fontSize:11,color:'#64748b'}}>{alert.message}</div>
                  </div>
                  <button style={S.dismissBtn} onClick={()=>setDismissed(prev=>new Set([...prev,alert.id]))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIDEBAR — detalle estudiante seleccionado */}
        {selectedStudent && (
          <div style={S.sidebar}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontSize:12,fontWeight:500,color:'#e2e8f0'}}>Detalle estudiante</span>
              <button style={S.dismissBtn} onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div style={{...S.avatar,width:44,height:44,fontSize:16,margin:'0 auto 10px',background:'rgba(0,212,255,0.1)',color:'#00d4ff'}}>
              {selectedStudent.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
            </div>
            <div style={{textAlign:'center',marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:500,color:'#e2e8f0'}}>{selectedStudent.name}</div>
              <div style={{fontSize:10,color:'#334155'}}>Pregunta {selectedStudent.lastQuestion}/{selectedStudent.totalQuestions}</div>
            </div>
            {[
              {label:'Puntaje actual',    val:`${selectedStudent.score} pts`,           color:selectedStudent.score>=70?'#34d399':selectedStudent.score>=50?'#fbbf24':'#f87171'},
              {label:'Ayudas IA usadas',  val:`${selectedStudent.aiHelpsUsed}/5`,       color:'#fbbf24'},
              {label:'Tasa espejo',       val:`${selectedStudent.mirrorSuccessRate}%`,  color:selectedStudent.mirrorSuccessRate>60?'#34d399':'#f87171'},
              {label:'Dependencia IA',    val:`${selectedStudent.helpDependency}%`,     color:selectedStudent.helpDependency>70?'#f87171':'#34d399'},
              {label:'Estrés cognitivo',  val:`${selectedStudent.cognitiveStress}%`,    color:selectedStudent.cognitiveStress>70?'#f87171':'#34d399'},
              {label:'Concentración',     val:`${selectedStudent.concentration}%`,      color:'#00d4ff'},
            ].map(stat=>(
              <div key={stat.label} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(255,255,255,0.04)',fontSize:11}}>
                <span style={{color:'#475569'}}>{stat.label}</span>
                <span style={{fontWeight:500,color:stat.color}}>{stat.val}</span>
              </div>
            ))}
            <div style={{marginTop:12}}>
              {AREAS.map(area=>(
                <div key={area} style={{marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                    <span style={{color:'#475569'}}>{area}</span>
                    <span style={{color:AREA_COLORS[area]}}>{selectedStudent.areas[area]}%</span>
                  </div>
                  <div style={{height:4,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${selectedStudent.areas[area]}%`,background:AREA_COLORS[area],borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const S: Record<string, any> = {
  shell:    { background:'#050914', minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif', color:'#e2e8f0' },
  topbar:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', background:'rgba(8,12,28,0.95)', borderBottom:'0.5px solid rgba(0,212,255,0.15)' },
  brand:    { display:'flex', alignItems:'center', gap:10 },
  pill:     (color:string,bg:string):React.CSSProperties => ({ fontSize:11, color, background:bg, padding:'4px 10px', borderRadius:20, border:`0.5px solid ${color}44` }),
  tabs:     { display:'flex', padding:'0 20px', background:'rgba(8,12,28,0.6)', borderBottom:'0.5px solid rgba(255,255,255,0.06)' },
  tab:      { padding:'9px 16px', fontSize:11, color:'#475569', cursor:'pointer', border:'none', background:'transparent', borderBottom:'2px solid transparent', transition:'all .2s', display:'flex', alignItems:'center', gap:6 },
  tabAct:   { color:'#00d4ff', borderBottomColor:'#00d4ff' },
  alertCount:{ background:'#ef4444', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:10, fontWeight:600 },
  body:     { flex:1, display:'grid', gridTemplateColumns:'1fr auto', gap:0, padding:16 },
  main:     { minWidth:0 },
  kpiRow:   { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 },
  kpi:      { background:'rgba(15,22,41,0.8)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'12px 14px' },
  tableCard:{ background:'rgba(15,22,41,0.8)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:10, overflow:'hidden' },
  tableHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'0.5px solid rgba(255,255,255,0.06)' },
  avatar:   { width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 },
  statusBadge:{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:500 },
  aiStudentRow:{ background:'rgba(15,22,41,0.8)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:10, padding:12, display:'flex', gap:10 },
  miniStat: { background:'rgba(255,255,255,0.03)', borderRadius:6, padding:'6px 8px' },
  areaRow:  { display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(15,22,41,0.8)', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.05)' },
  riskTag:  { fontSize:9, color:'#f87171', background:'rgba(239,68,68,0.1)', padding:'1px 6px', borderRadius:20, border:'0.5px solid rgba(239,68,68,0.2)' },
  cogCard:  { background:'rgba(15,22,41,0.8)', border:'0.5px solid', borderRadius:10, padding:10 },
  alertCard:{ background:'rgba(255,255,255,0.02)', borderLeft:'3px solid', borderRadius:'0 8px 8px 0', padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:10 },
  dismissBtn:{ background:'transparent', border:'none', color:'#334155', cursor:'pointer', fontSize:14, padding:'2px 6px' },
  sidebar:  { width:220, marginLeft:12, background:'rgba(8,12,28,0.8)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:10, padding:12, alignSelf:'start', position:'sticky', top:16 },
};
