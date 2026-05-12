import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PlayersTab from '../components/PlayersTab'
import SessionsTab from '../components/SessionsTab'
import StatsTab from '../components/StatsTab'
import ExpensesTab from '../components/ExpensesTab'
import PlayerHistoryModal from '../components/PlayerHistoryModal'
import ToastContainer from '../components/Toast'
import TableView from '../components/TableView'

const TABS = [
  { id: 'table', label: '🪑 שולחן' },
  { id: 'sessions', label: '📋 משחקים' },
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
  const [tab, setTab] = useState('table')
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [tableName, setTableName] = useState('')
  const [historyPlayer, setHistoryPlayer] = useState(null)
  const [toasts, setToasts] = useState([])
  const playersRef = useRef([])
  const tableRef = useRef(null)

  const isOwner = user?.id === table?.owner_id
  const canEdit = !!user  // anyone logged in can manage players/sessions/expenses

  function pushToast(type, message) {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, type, message }])
  }
  function removeToast(id) {
    setToasts(t => t.filter(x => x.id !== id))
  }

  const fetchAll = useCallback(async () => {
    const [tbl, plrs, sess, exp] = await Promise.all([
      supabase.from('tables').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('table_id', id).order('created_at'),
      supabase.from('sessions').select('*').eq('table_id', id).order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('table_id', id).order('date', { ascending: false }),
    ])
    if (tbl.data) { setTable(tbl.data); setTableName(tbl.data.name); tableRef.current = tbl.data }
    if (plrs.data) { setPlayers(plrs.data); playersRef.current = plrs.data }
    if (sess.data) setSessions(sess.data)
    if (exp.data) setExpenses(exp.data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchAll()

    // Realtime subscriptions with notifications
    const channel = supabase
      .channel(`table-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions', filter: `table_id=eq.${id}` },
        (p) => {
          if (p.new?.is_live) {
            const player = playersRef.current.find(x => x.id === p.new.player_id)
            const buyIn = Number(tableRef.current?.buy_in_amount || 50)
            const chips = Number(tableRef.current?.chips_per_buyin || 200)
            if (player) pushToast('start', `${player.name} נכנס למשחק (₪${buyIn} = ${chips} ג'יטונים)`)
          }
          fetchAll()
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `table_id=eq.${id}` },
        (p) => {
          if (p.new && p.old) {
            const newBuyIn = Number(p.new.buy_in || 0)
            const oldBuyIn = Number(p.old.buy_in || 0)
            const newCashOut = Number(p.new.cash_out || 0)
            const oldCashOut = Number(p.old.cash_out || 0)
            const player = playersRef.current.find(x => x.id === p.new.player_id)
            const buyInAmt = Number(tableRef.current?.buy_in_amount || 50)
            const chipsAmt = Number(tableRef.current?.chips_per_buyin || 200)

            if (player && newBuyIn > oldBuyIn && p.new.is_live) {
              const added = newBuyIn - oldBuyIn
              const numNewBuyIns = Math.round(added / buyInAmt)
              pushToast('rebuy', `🔁 ${player.name} ביצע קנייה חוזרת! (+${chipsAmt * numNewBuyIns} ג'יטונים)`)
            }
            if (player && newCashOut > 0 && oldCashOut === 0 && !p.new.is_live) {
              const profit = newCashOut - newBuyIn
              const sign = profit >= 0 ? '+' : ''
              pushToast(profit >= 0 ? 'success' : 'info', `${player.name} סיים: ${sign}₪${Math.round(profit).toLocaleString()}`)
            }
          }
          fetchAll()
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions', filter: `table_id=eq.${id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `table_id=eq.${id}` },
        (p) => {
          if (p.eventType === 'INSERT' && p.new?.name) pushToast('info', `שחקן חדש נוסף: ${p.new.name}`)
          fetchAll()
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${id}` },
        (p) => {
          if (p.new && p.old) {
            if (p.new.is_live && !p.old.is_live) pushToast('start', '▶ משחק חדש התחיל!')
            if (!p.new.is_live && p.old.is_live) pushToast('end', '🏁 המשחק הסתיים')
          }
          fetchAll()
        })
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

  async function shareTable() {
    // Use the short /t/CODE URL if available
    const shortUrl = table.code
      ? `${window.location.origin}/t/${table.code}`
      : window.location.href
    const codePart = table.code ? `\nקוד שולחן: ${table.code}` : ''
    const shareText = `הצטרף לשולחן הפוקר "${table.name}"${codePart}\n${shortUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `שולחן הפוקר - ${table.name}`, text: shareText, url: shortUrl })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(shareText)
      pushToast('success', '✓ הקישור הועתק!')
    } catch (e) {
      alert('הקישור: ' + shortUrl)
    }
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
  // Live game stats: total money in pot + total chips at the table
  const liveSessionsAll = sessions.filter(s => s.is_live)
  const liveTotalPot = liveSessionsAll.reduce((a, s) => a + Number(s.buy_in || 0), 0)
  const buyInAmt = Number(table?.buy_in_amount || 50)
  const chipsAmt = Number(table?.chips_per_buyin || 200)
  const liveTotalChips = buyInAmt > 0 ? (liveTotalPot / buyInAmt) * chipsAmt : 0

  const tabProps = { tableId: id, players, sessions, expenses, canEdit, onRefresh: fetchAll, onPlayerClick: setHistoryPlayer }

  return (
    <div className="page">
      {/* Back button - fixed at top */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'sticky',
          top: 10,
          marginTop: 10,
          marginBottom: -34,
          zIndex: 10,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(212,175,55,0.4)',
          color: '#fbbf24',
          padding: '6px 14px 6px 12px',
          borderRadius: 99,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontFamily: 'Heebo, sans-serif',
        }}
      >
        → חזור
      </button>
      <div className="app-header" style={{ paddingTop: 34 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {table.code && (
            <span className="table-code" onClick={() => { navigator.clipboard.writeText(table.code); pushToast('success', `הקוד ${table.code} הועתק`) }} title="לחץ להעתקה">
              🔑 {table.code}
            </span>
          )}
          {table.is_live && <span className="badge badge-live">● משחק חי</span>}
          <button
            onClick={shareTable}
            className="btn btn-gold"
            style={{ padding: '5px 12px', fontSize: 12, gap: 4 }}
            title="שתף שולחן"
          >
            🔗 שתף
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-box">
          <div className="val" style={{ color: '#fbbf24' }}>
            🪙 {Math.round(liveTotalChips).toLocaleString()}
          </div>
          <div className="lbl">{table.is_live ? 'ג\'יטונים בשולחן' : 'אין משחק חי'}</div>
        </div>
        <div className="stat-box">
          <div className="val" style={{ color: table.is_live ? '#4ade80' : 'var(--text-muted)' }}>
            ₪{liveTotalPot.toLocaleString()}
          </div>
          <div className="lbl">{table.is_live ? 'סך הכסף בשולחן' : 'קופה ריקה'}</div>
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

      {tab === 'table' && <TableView table={table} players={players} sessions={sessions} canEdit={canEdit} user={user} onPlayerClick={setHistoryPlayer} />}
      {tab === 'sessions' && <SessionsTab {...tabProps} />}
      {tab === 'players' && <PlayersTab {...tabProps} />}
      {tab === 'expenses' && <ExpensesTab {...tabProps} />}
      {tab === 'stats' && <StatsTab {...tabProps} />}

      {historyPlayer && (
        <PlayerHistoryModal
          player={historyPlayer}
          sessions={sessions}
          onClose={() => setHistoryPlayer(null)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
