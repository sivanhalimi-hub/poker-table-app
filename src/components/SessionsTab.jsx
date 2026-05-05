import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function SessionsTab({ tableId, players, sessions, canEdit, onRefresh, onPlayerClick }) {
  const [showForm, setShowForm] = useState(false)
  const [editSession, setEditSession] = useState(null)
  const [form, setForm] = useState({ player_id: '', date: today(), buy_in: '', cash_out: '', hours: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('by-date') // 'by-date' or 'by-session'
  const [expandedDates, setExpandedDates] = useState({})

  function today() { return new Date().toISOString().split('T')[0] }

  function openNew() {
    setEditSession(null)
    setForm({ player_id: players[0]?.id || '', date: today(), buy_in: '', cash_out: '', hours: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(s) {
    setEditSession(s)
    setForm({ player_id: s.player_id, date: s.date, buy_in: s.buy_in, cash_out: s.cash_out, hours: s.hours, notes: s.notes || '' })
    setShowForm(true)
  }

  async function save() {
    if (!form.player_id || form.buy_in === '') return
    setSaving(true)
    const payload = {
      table_id: tableId,
      player_id: form.player_id,
      date: form.date,
      buy_in: Number(form.buy_in),
      cash_out: Number(form.cash_out) || 0,
      hours: Number(form.hours) || 0,
      notes: form.notes
    }
    if (editSession) {
      await supabase.from('sessions').update(payload).eq('id', editSession.id)
    } else {
      await supabase.from('sessions').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    onRefresh()
  }

  async function deleteSession(id) {
    if (!confirm('למחוק סשן זה?')) return
    await supabase.from('sessions').delete().eq('id', id)
    onRefresh()
  }

  async function deleteGameDay(date, sessionsToDelete) {
    if (!confirm(`למחוק את כל המשחק מ-${new Date(date).toLocaleDateString('he-IL')}? (${sessionsToDelete.length} סשנים יימחקו)`)) return
    for (const s of sessionsToDelete) {
      await supabase.from('sessions').delete().eq('id', s.id)
    }
    onRefresh()
  }

  function playerName(pid) { return players.find(p => p.id === pid)?.name || '?' }
  function playerColor(pid) { return players.find(p => p.id === pid)?.color || '#888' }
  function playerById(pid) { return players.find(p => p.id === pid) }

  // Group sessions by date (excluding live ones, since they're in-progress)
  const gamesByDate = useMemo(() => {
    const groups = {}
    for (const s of sessions) {
      if (s.is_live) continue
      if (!groups[s.date]) groups[s.date] = []
      groups[s.date].push(s)
    }
    // Sort dates desc
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => {
        const totalProfit = items.reduce((a, x) => a + Number(x.profit || 0), 0)
        const totalBuyIn = items.reduce((a, x) => a + Number(x.buy_in || 0), 0)
        const totalCashOut = items.reduce((a, x) => a + Number(x.cash_out || 0), 0)
        const hours = items[0]?.hours || 0
        const notes = items.map(x => x.notes).filter(Boolean)
        return { date, items, totalProfit, totalBuyIn, totalCashOut, hours, notes }
      })
  }, [sessions])

  function toggleDate(date) {
    setExpandedDates(s => ({ ...s, [date]: !s[date] }))
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
        <button className={`tab ${view === 'by-date' ? 'active' : ''}`} onClick={() => setView('by-date')}>
          📅 לפי משחק (תאריך)
        </button>
        <button className={`tab ${view === 'by-session' ? 'active' : ''}`} onClick={() => setView('by-session')}>
          📋 לפי סשן
        </button>
      </div>

      {canEdit && (
        <button className="btn btn-red btn-block" style={{ marginBottom: 14 }} onClick={openNew}>
          + הוסף סשן ידני
        </button>
      )}

      {/* By Date View */}
      {view === 'by-date' && (
        gamesByDate.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            אין משחקים עדיין
          </div>
        ) : gamesByDate.map(g => {
          const expanded = expandedDates[g.date]
          // Sort items by profit desc
          const sortedItems = [...g.items].sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0))
          return (
            <div key={g.date} className="card" style={{ padding: 14 }}>
              {/* Date header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleDate(g.date)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Playfair Display' }}>
                    {new Date(g.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {g.items.length} שחקנים · קופה ₪{g.totalBuyIn.toLocaleString()}
                    {g.hours > 0 && ` · ${g.hours}ש'`}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>{expanded ? '▾' : '◂'}</div>
              </div>

              {/* Player chips - always visible (compact horizontal) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {sortedItems.map(s => {
                  const profit = Number(s.profit || 0)
                  const p = playerById(s.player_id)
                  return (
                    <div
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); onPlayerClick?.(p) }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 10px',
                        borderRadius: 99,
                        background: profit > 0
                          ? 'rgba(22,163,74,0.18)'
                          : profit < 0
                          ? 'rgba(220,38,38,0.18)'
                          : 'rgba(217,119,6,0.18)',
                        border: `1px solid ${profit > 0 ? 'rgba(22,163,74,0.45)' : profit < 0 ? 'rgba(220,38,38,0.45)' : 'rgba(217,119,6,0.45)'}`,
                        cursor: onPlayerClick ? 'pointer' : 'default',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: playerColor(s.player_id), display: 'inline-block', boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.3)' }} />
                      <span>{playerName(s.player_id)}</span>
                      <span style={{ color: profit > 0 ? '#4ade80' : profit < 0 ? '#f87171' : '#fbbf24' }}>
                        {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Notes */}
              {g.notes.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  📝 {g.notes.join(' | ')}
                </div>
              )}

              {/* Expanded: full per-player breakdown */}
              {expanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {sortedItems.map(s => {
                    const profit = Number(s.profit || 0)
                    const pColor = playerColor(s.player_id)
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="avatar" style={{ background: pColor, width: 28, height: 28, fontSize: 12 }}>
                          {playerName(s.player_id)[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{playerName(s.player_id)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            כניסה ₪{s.buy_in} · יציאה ₪{s.cash_out}
                            {s.final_chips > 0 && ` · ${s.final_chips} ג'יטונים`}
                          </div>
                        </div>
                        <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`}>
                          {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                        </span>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); openEdit(s) }}>✎</button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#f87171' }} onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}>✕</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {canEdit && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '5px 10px', marginTop: 10, color: '#f87171' }}
                      onClick={(e) => { e.stopPropagation(); deleteGameDay(g.date, g.items) }}
                    >
                      ✕ מחק את כל המשחק
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* By Session View (original) */}
      {view === 'by-session' && (
        sessions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            אין סשנים עדיין
          </div>
        ) : sessions.filter(s => !s.is_live).map(s => {
          const profit = Number(s.profit ?? (s.cash_out - s.buy_in))
          const pColor = playerColor(s.player_id)
          const p = playerById(s.player_id)
          return (
            <div key={s.id} className="card" style={{ borderRight: `3px solid ${pColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onPlayerClick ? 'pointer' : 'default' }}
                  onClick={() => onPlayerClick?.(p)}>
                  <div className="avatar" style={{ background: pColor, width: 34, height: 34, fontSize: 14 }}>
                    {playerName(s.player_id)[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{playerName(s.player_id)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(s.date).toLocaleDateString('he-IL')} · {s.hours}ש'
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`}>
                    {profit > 0 ? '+' : ''}₪{profit.toLocaleString()}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    כניסה ₪{s.buy_in} · יציאה ₪{s.cash_out}
                  </div>
                </div>
              </div>
              {s.notes && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>{s.notes}</div>}
              {canEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => openEdit(s)}>✎ עריכה</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: '#f87171' }} onClick={() => deleteSession(s.id)}>✕ מחק</button>
                </div>
              )}
            </div>
          )
        })
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 20 }}>
              {editSession ? 'עריכת סשן' : 'סשן חדש'}
            </h2>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>שחקן</label>
              <select value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: e.target.value }))}>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label>תאריך</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>שעות</label>
                <input type="number" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label>כניסה (₪)</label>
                <input type="number" value={form.buy_in} onChange={e => setForm(f => ({ ...f, buy_in: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>יציאה (₪)</label>
                <input type="number" value={form.cash_out} onChange={e => setForm(f => ({ ...f, cash_out: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {form.buy_in !== '' && form.cash_out !== '' && (
              <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 16, fontWeight: 700 }}
                className={Number(form.cash_out) - Number(form.buy_in) >= 0 ? 'profit-pos' : 'profit-neg'}>
                {Number(form.cash_out) - Number(form.buy_in) >= 0 ? '+' : ''}₪{(Number(form.cash_out) - Number(form.buy_in)).toLocaleString()}
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>הערות</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="הערות אופציונליות..." />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
