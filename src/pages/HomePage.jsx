import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const COLORS = ['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#65a30d']

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchTables()
  }, [user])

  async function fetchTables() {
    setLoading(true)
    const { data } = await supabase
      .from('tables')
      .select('*, players(count), sessions(count)')
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

  const myTables = tables.filter(t => t.owner_id === user?.id)
  const otherTables = tables.filter(t => t.owner_id !== user?.id)

  return (
    <div className="page">
      <div className="app-header">
        <div className="suits">♠ ♥ ♦ ♣</div>
        <h1>שולחן הפוקר</h1>
        <div className="subtitle">
          שלום {user?.user_metadata?.name?.split(' ')[0] || 'שחקן'} ·{' '}
          <span style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={signOut}>התנתק</span>
        </div>
      </div>

      {/* My tables */}
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
        myTables.map(t => <TableCard key={t.id} table={t} onClick={() => navigate(`/table/${t.id}`)} isOwner />)
      )}

      {otherTables.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, margin: '20px 0 10px' }}>
            שולחנות אחרים (צפייה בלבד)
          </div>
          {otherTables.map(t => <TableCard key={t.id} table={t} onClick={() => navigate(`/table/${t.id}`)} />)}
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

function TableCard({ table, onClick, isOwner }) {
  return (
    <div className="table-card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #dc2626, #991b1b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20
        }}>♠</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{table.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date(table.created_at).toLocaleDateString('he-IL')}
            {isOwner && ' · שלי'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {table.is_live && <span className="badge badge-live">● חי</span>}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>← כניסה</div>
      </div>
    </div>
  )
}
