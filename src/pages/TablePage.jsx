import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PlayersTab from '../components/PlayersTab'
import SessionsTab from '../components/SessionsTab'
import LiveTab from '../components/LiveTab'
import StatsTab from '../components/StatsTab'
import ExpensesTab from '../components/ExpensesTab'

const TABS = [
  { id: 'live', label: '● חי' },
  { id: 'sessions', label: '📋 סשנים' },
  { id: 'players', label: '👥 שחקנים' },
  { id: 'expenses', label: '💸 הוצאות' },
  { id: 'stats', label: '📊 גרפים' },
]

export default function TablePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [table, setTable] = useState(null)
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [expenses, setExpenses] = useState([])
  const [tab, setTab] = useState('live')
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [tableName, setTableName] = useState('')

  const isOwner = user?.id === table?.owner_id
  const canEdit = !!user  // anyone logged in can manage players/sessions/expenses

  const fetchAll = useCallback(async () => {
    const [tbl, plrs, sess, exp] = await Promise.all([
      supabase.from('tables').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('table_id', id).order('created_at'),
      supabase.from('sessions').select('*').eq('table_id', id).order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('table_id', id).order('date', { ascending: false }),
    ])
    if (tbl.data) { setTable(tbl.data); setTableName(tbl.data.name) }
    if (plrs.data) setPlayers(plrs.data)
    if (sess.data) setSessions(sess.data)
    if (exp.data) setExpenses(exp.data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchAll()

    // Realtime subscriptions
    const channel = supabase
      .channel(`table-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `table_id=eq.${id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `table_id=eq.${id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `table_id=eq.${id}` },
        () => fetchAll())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, fetchAll])

  async function saveName() {
    if (!tableName.trim()) return
    await supabase.from('tables').update({ name: tableName }).eq('id', id)
    setEditingName(false)
    setTable(t => ({ ...t, name: tableName }))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      טוען...
    </div>
  )

  if (!table) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      שולחן לא נמצא
    </div>
  )

  const totalProfit = sessions.reduce((s, x) => s + (x.profit || 0), 0)
  const totalHours = sessions.reduce((s, x) => s + (x.hours || 0), 0)

  const tabProps = { tableId: id, players, sessions, expenses, canEdit, onRefresh: fetchAll }

  return (
    <div className="page">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, textAlign: 'center', maxWidth: 240 }}
                autoFocus
              />
              <button className="btn btn-green" style={{ padding: '8px 14px' }} onClick={saveName}>✓</button>
              <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={() => setEditingName(false)}>✕</button>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Playfair Display' }}>{table.name}</h1>
              {isOwner && (
                <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>
                  ✎
                </button>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
          {table.is_live && <span className="badge badge-live">● משחק חי</span>}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
            → כל השולחנות
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-box">
          <div className={`val ${totalProfit > 0 ? 'profit-pos' : totalProfit < 0 ? 'profit-neg' : ''}`}>
            ₪{Math.abs(totalProfit).toLocaleString()}
          </div>
          <div className="lbl">סה"כ {totalProfit >= 0 ? 'רווח' : 'הפסד'}</div>
        </div>
        <div className="stat-box">
          <div className="val">{sessions.length}</div>
          <div className="lbl">סשנים</div>
        </div>
        <div className="stat-box">
          <div className="val">{totalHours}ש'</div>
          <div className="lbl">שעות</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ justifyContent: 'center' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'live' && <LiveTab {...tabProps} table={table} />}
      {tab === 'sessions' && <SessionsTab {...tabProps} />}
      {tab === 'players' && <PlayersTab {...tabProps} />}
      {tab === 'expenses' && <ExpensesTab {...tabProps} />}
      {tab === 'stats' && <StatsTab {...tabProps} />}
    </div>
  )
}
