import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import CreateTableWizard from '../components/CreateTableWizard'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    fetchTables()
  }, [user])

  async function fetchTables() {
    setLoading(true)
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('created_at', { ascending: false })
    setTables(data || [])
    setLoading(false)
  }

  async function joinByCode() {
    const code = joinCode.trim().toUpperCase().replace(/[\s-]/g, '')
    if (!code) return
    setJoining(true)
    setJoinError('')
    const { data, error } = await supabase
      .from('tables')
      .select('id, code')
      .eq('code', code)
      .maybeSingle()
    setJoining(false)
    if (error || !data) {
      setJoinError('הקוד לא נמצא. בדוק שהקוד נכון.')
      return
    }
    navigate(`/table/${data.id}`)
  }

  function copyCode(code, e) {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
  }

  const myTables = tables.filter(t => t.owner_id === user?.id)
  const otherTables = tables.filter(t => t.owner_id !== user?.id)
  const liveTables = tables.filter(t => t.is_live)

  return (
    <div className="page">
      <div className="app-header">
        <div className="suits">♠ ♥ ♦ ♣</div>
        <h1>שולחן הפוקר</h1>
        <div className="subtitle">
          שלום {user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'שחקן'} ·{' '}
          <span style={{ cursor: 'pointer', color: 'var(--gold-light)' }} onClick={signOut}>התנתק</span>
        </div>
      </div>

      {/* Live games highlight */}
      {liveTables.length > 0 && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.05))',
          border: '1px solid rgba(220,38,38,0.45)',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="live-dot" />
            <div style={{ fontWeight: 700, color: '#f87171' }}>משחקים חיים עכשיו</div>
          </div>
          {liveTables.map(t => (
            <div key={t.id} onClick={() => navigate(`/table/${t.id}`)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 8,
              marginBottom: 6, cursor: 'pointer'
            }}>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>← הצטרף</div>
            </div>
          ))}
        </div>
      )}

      {/* Two main CTAs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Create new table */}
        <button
          onClick={() => setShowWizard(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(220,38,38,0.25), rgba(153,27,27,0.15))',
            border: '1px solid rgba(220,38,38,0.45)',
            borderRadius: 18,
            padding: '24px 14px',
            cursor: 'pointer',
            color: '#f0e6d3',
            transition: 'all 0.2s',
            textAlign: 'center',
            fontFamily: 'Heebo, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(220,38,38,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🃏</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>שולחן חדש</div>
          <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.6)', marginTop: 4 }}>
            שם, שחקנים, סכומי קנייה
          </div>
        </button>

        {/* Join by code */}
        <button
          onClick={() => setShowJoin(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(184,134,11,0.10))',
            border: '1px solid rgba(212,175,55,0.4)',
            borderRadius: 18,
            padding: '24px 14px',
            cursor: 'pointer',
            color: '#f0e6d3',
            transition: 'all 0.2s',
            textAlign: 'center',
            fontFamily: 'Heebo, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,175,55,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>הצטרף עם קוד</div>
          <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.6)', marginTop: 4 }}>
            כניסה לשולחן קיים
          </div>
        </button>
      </div>

      {/* My tables */}
      <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
        השולחנות שלי
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>טוען...</div>
      ) : myTables.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.7 }}>♠</div>
          אין לך עדיין שולחנות.<br/>
          <span style={{ fontSize: 12, opacity: 0.7 }}>צור שולחן חדש למעלה כדי להתחיל</span>
        </div>
      ) : (
        myTables.map(t => <TableCard key={t.id} table={t} onClick={() => navigate(`/table/${t.id}`)} onCopyCode={copyCode} isOwner />)
      )}

      {otherTables.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, margin: '20px 0 10px' }}>
            שולחנות אחרים
          </div>
          {otherTables.map(t => <TableCard key={t.id} table={t} onClick={() => navigate(`/table/${t.id}`)} onCopyCode={copyCode} />)}
        </>
      )}

      {/* Create table wizard */}
      {showWizard && (
        <CreateTableWizard
          user={user}
          onClose={() => setShowWizard(false)}
          onCreated={(table) => {
            setShowWizard(false)
            fetchTables()
            navigate(`/table/${table.id}`)
          }}
        />
      )}

      {/* Join by code modal */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 8, textAlign: 'center' }}>
              🔑 הצטרף עם קוד
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
              הזן קוד שולחן שקיבלת מהבעלים
            </div>
            <input
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              placeholder="ABC123"
              onKeyDown={e => e.key === 'Enter' && joinByCode()}
              autoFocus
              style={{
                fontFamily: 'Courier New, monospace',
                fontSize: 22, letterSpacing: 4, textAlign: 'center', fontWeight: 700,
                textTransform: 'uppercase', padding: '12px',
              }}
              maxLength={8}
            />
            {joinError && (
              <div style={{ color: '#f87171', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{joinError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={joinByCode} disabled={joining || !joinCode.trim()}>
                {joining ? 'מחפש...' : 'כנס'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowJoin(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TableCard({ table, onClick, onCopyCode, isOwner }) {
  return (
    <div className="table-card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #dc2626, #991b1b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          flexShrink: 0,
        }}>♠</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {table.code && (
              <span className="table-code" onClick={e => onCopyCode(table.code, e)} title="לחץ להעתקה">
                🔑 {table.code}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(table.created_at).toLocaleDateString('he-IL')}
              {isOwner && ' · שלי'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {table.is_live && <span className="badge badge-live">● חי</span>}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>← כניסה</div>
      </div>
    </div>
  )
}
