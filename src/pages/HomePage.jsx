import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
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

  async function createTable() {
    if (!newName.trim()) return
    setCreating(true)
    const { data } = await supabase
      .from('tables')
      .insert({ name: newName.trim(), owner_id: user.id })
      .select()
      .single()
    setCreating(false)
    setShowNew(false)
    setNewName('')
    if (data) navigate(`/table/${data.id}`)
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
      setJoinError('קוד לא נמצא. בדוק שהקוד נכון.')
      return
    }
    navigate(`/table/${data.id}`)
  }

  function copyCode(code, e) {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    // brief visual feedback would be nice; alert is acceptable for now
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
          marginBottom: 16
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

      {/* Quick join by code */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(212,175,55,0.10), rgba(184,134,11,0.05))',
        border: '1px solid rgba(212,175,55,0.25)',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 700 }}>
          🔑 הצטרף לשולחן עם קוד
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
            placeholder="ABC123"
            onKeyDown={e => e.key === 'Enter' && joinByCode()}
            style={{
              flex: 1, fontFamily: 'Courier New, monospace',
              fontSize: 16, letterSpacing: 2, textAlign: 'center', fontWeight: 700,
              textTransform: 'uppercase'
            }}
            maxLength={8}
          />
          <button className="btn btn-gold" onClick={joinByCode} disabled={joining || !joinCode.trim()}>
            {joining ? '...' : 'כנס'}
          </button>
        </div>
        {joinError && (
          <div style={{ color: '#f87171', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{joinError}</div>
        )}
      </div>

      {/* My tables header */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>השולחנות שלי</div>
        <button className="btn btn-red" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setShowNew(true)}>
          + שולחן חדש
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>טוען...</div>
      ) : myTables.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>♠</div>
          אין לך שולחנות עדיין. צור שולחן ראשון!
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

      {/* New table modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 20 }}>שולחן חדש</h2>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>שם השולחן</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder='למשל: "בית של יוסי"'
                onKeyDown={e => e.key === 'Enter' && createTable()}
                autoFocus
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              לאחר היצירה תקבל קוד ייחודי לשתף עם השחקנים.<br/>
              ברירות מחדל: קנייה ₪50 = 200 ג'יטונים (ניתן לשנות בהגדרות).
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-red" style={{ flex: 1 }} onClick={createTable} disabled={creating}>
                {creating ? 'יוצר...' : 'צור שולחן'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>ביטול</button>
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
              <span className="table-code" onClick={e => onCopyCode(table.code, e)} title="לחץ להעתקת הקוד">
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
