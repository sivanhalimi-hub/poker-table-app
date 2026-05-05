import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function LiveTab({ tableId, players, sessions, canEdit, table, onRefresh, onPlayerClick }) {
  const { user } = useAuth()
  const isTableOwner = user?.id === table.owner_id
  const [startTime, setStartTime] = useState(table.live_start ? new Date(table.live_start) : null)
  const [elapsed, setElapsed] = useState('00:00')
  const [finalChips, setFinalChips] = useState({})
  const [saving, setSaving] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    buy_in_amount: table.buy_in_amount || 50,
    chips_per_buyin: table.chips_per_buyin || 200,
  })
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const QUICK_COLORS = ['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#65a30d','#f97316','#84cc16','#facc15','#a855f7']

  const buyInAmount = Number(table.buy_in_amount || 50)
  const chipsPerBuyin = Number(table.chips_per_buyin || 200)
  const chipValue = chipsPerBuyin > 0 ? buyInAmount / chipsPerBuyin : 0.25

  const liveSessions = sessions.filter(s => s.is_live)
  const livePlayerIds = liveSessions.map(s => s.player_id)
  const livePlayers = players.filter(p => livePlayerIds.includes(p.id))
  const isLive = table.is_live

  useEffect(() => {
    setStartTime(table.live_start ? new Date(table.live_start) : null)
  }, [table.live_start])

  useEffect(() => {
    if (!startTime) { setElapsed('00:00'); return }
    const tick = () => {
      const diff = Date.now() - startTime.getTime()
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
      setElapsed(`${h}:${m}`)
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [startTime])

  function openStartModal() {
    setSelectedPlayers(players.map(p => p.id))
    setShowStartModal(true)
  }

  async function startGame() {
    if (selectedPlayers.length === 0) {
      alert('בחר לפחות שחקן אחד')
      return
    }
    setSaving(true)
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const newSessions = selectedPlayers.map(pid => ({
      table_id: tableId,
      player_id: pid,
      date: today,
      buy_in: buyInAmount,
      cash_out: 0,
      hours: 0,
      is_live: true,
    }))

    await supabase.from('sessions').insert(newSessions)
    await supabase.from('tables').update({ is_live: true, live_start: now }).eq('id', tableId)
    setStartTime(new Date(now))
    setShowStartModal(false)
    setFinalChips({})
    setSaving(false)
    onRefresh()
  }

  async function addBuyIn(sessionId, currentBuyIn) {
    await supabase.from('sessions').update({ buy_in: Number(currentBuyIn || 0) + buyInAmount }).eq('id', sessionId)
    onRefresh()
  }

  async function removeBuyIn(sessionId, currentBuyIn) {
    const newAmount = Math.max(0, Number(currentBuyIn || 0) - buyInAmount)
    await supabase.from('sessions').update({ buy_in: newAmount }).eq('id', sessionId)
    onRefresh()
  }

  async function endGame() {
    const missing = livePlayerIds.filter(pid => {
      const v = finalChips[pid]
      return v === undefined || v === ''
    })
    if (missing.length > 0) {
      const names = missing.map(pid => players.find(p => p.id === pid)?.name).filter(Boolean).join(', ')
      if (!confirm(`לא הוזנו ג'יטונים סופיים עבור: ${names}\nלסיים בכל זאת? (יקבלו 0 ג'יטונים)`)) return
    }

    setSaving(true)
    const hours = startTime ? Number(((Date.now() - startTime.getTime()) / 3600000).toFixed(2)) : 0

    for (const ls of liveSessions) {
      const chips = Number(finalChips[ls.player_id] || 0)
      const cash_out = Math.round((chips * chipValue) * 100) / 100
      await supabase.from('sessions').update({
        cash_out,
        final_chips: chips,
        hours,
        is_live: false,
      }).eq('id', ls.id)
    }

    await supabase.from('tables').update({ is_live: false, live_start: null }).eq('id', tableId)
    setStartTime(null)
    setFinalChips({})
    setSaving(false)
    onRefresh()
  }

  async function cancelGame() {
    if (!confirm('לבטל את המשחק? כל הקניות והנתונים מהמשחק הזה יימחקו.')) return
    setSaving(true)
    for (const ls of liveSessions) {
      await supabase.from('sessions').delete().eq('id', ls.id)
    }
    await supabase.from('tables').update({ is_live: false, live_start: null }).eq('id', tableId)
    setStartTime(null)
    setFinalChips({})
    setSaving(false)
    onRefresh()
  }

  async function addNewPlayer() {
    const name = newPlayerName.trim()
    if (!name) return
    setAddingPlayer(true)
    const usedColors = players.map(p => p.color)
    const color = QUICK_COLORS.find(c => !usedColors.includes(c)) || QUICK_COLORS[players.length % QUICK_COLORS.length]
    const { data, error } = await supabase
      .from('players')
      .insert({ table_id: tableId, name, color })
      .select()
      .single()
    setAddingPlayer(false)
    if (data) {
      // auto-select the new player
      setSelectedPlayers(s => [...s, data.id])
      setNewPlayerName('')
      onRefresh()
    } else if (error) {
      alert('שגיאה בהוספת שחקן: ' + error.message)
    }
  }

  async function saveSettings() {
    const bi = Number(settingsForm.buy_in_amount)
    const cb = Number(settingsForm.chips_per_buyin)
    if (bi <= 0 || cb <= 0) { alert('ערכים חייבים להיות חיוביים'); return }
    await supabase.from('tables').update({ buy_in_amount: bi, chips_per_buyin: cb }).eq('id', tableId)
    setShowSettings(false)
    onRefresh()
  }

  // Live game totals
  const totalBuyIns = liveSessions.reduce((a, s) => a + Number(s.buy_in || 0), 0)
  const totalChipsValue = livePlayerIds.reduce((a, pid) => {
    const v = finalChips[pid]
    if (v === undefined || v === '') return a
    return a + Number(v) * chipValue
  }, 0)
  const allChipsEntered = livePlayerIds.every(pid => finalChips[pid] !== undefined && finalChips[pid] !== '')
  const balance = Math.round((totalChipsValue - totalBuyIns) * 100) / 100

  return (
    <div>
      {/* Game status card */}
      <div className="card" style={{
        background: isLive ? 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))' : 'var(--bg2)',
        border: isLive ? '1px solid rgba(220,38,38,0.4)' : '1px solid var(--border)',
        textAlign: 'center', padding: 28, marginBottom: 14
      }}>
        {isLive ? (
          <>
            <div style={{ fontSize: 13, color: '#f87171', fontWeight: 700, marginBottom: 8 }}>
              <span className="live-dot" style={{ marginLeft: 6 }} /> משחק פעיל
            </div>
            <div style={{ fontSize: 52, fontWeight: 900, fontFamily: 'Playfair Display', letterSpacing: 2, color: '#fbbf24' }}>
              {elapsed}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>שעות:דקות</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
              קנייה: ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים · ערך ג'יטון: ₪{chipValue.toFixed(2)}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>♠</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 16 }}>
              {players.length === 0 ? 'הוסף שחקנים תחילה' : 'אין משחק פעיל כרגע'}
            </div>
            {canEdit && players.length > 0 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-red" style={{ fontSize: 15, padding: '12px 28px' }} onClick={openStartModal}>
                  ▶ התחל משחק חדש
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setShowSettings(true)}>
                  ⚙ הגדרות
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
              קנייה ברירת מחדל: ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים
            </div>
          </>
        )}
      </div>

      {/* Live game players */}
      {isLive && livePlayers.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>שחקני המשחק ({livePlayers.length})</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
              סה"כ קופה: ₪{totalBuyIns.toLocaleString()}
            </span>
          </div>
          {livePlayers.map(p => {
            const ls = liveSessions.find(s => s.player_id === p.id)
            if (!ls) return null
            const totalBuyIn = Number(ls.buy_in || 0)
            const totalChips = chipsPerBuyin > 0 ? (totalBuyIn / buyInAmount) * chipsPerBuyin : 0
            const numBuyIns = buyInAmount > 0 ? Math.round(totalBuyIn / buyInAmount) : 0
            const fc = finalChips[p.id]
            const hasFc = fc !== undefined && fc !== ''
            const profit = hasFc ? Math.round((Number(fc) * chipValue - totalBuyIn) * 100) / 100 : null
            // ownership: owner can manage all; if player is claimed, only the claimed user; if unclaimed, anyone authenticated
            const canManageThisPlayer = canEdit && (isTableOwner || !p.user_id || p.user_id === user?.id)
            const isMine = p.user_id === user?.id
            return (
              <div key={p.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12, marginBottom: 10, borderRight: `3px solid ${p.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div className="avatar" style={{ background: p.color, width: 36, height: 36, fontSize: 14, cursor: onPlayerClick ? 'pointer' : 'default' }}
                    onClick={() => onPlayerClick?.(p)}>
                    {p.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: onPlayerClick ? 'pointer' : 'default' }} onClick={() => onPlayerClick?.(p)}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.name}
                      {isMine && <span style={{ fontSize: 10, color: 'var(--gold-light)' }}>★</span>}
                      {p.user_id && !isMine && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {numBuyIns} {numBuyIns === 1 ? 'קנייה' : 'קניות'} · ₪{totalBuyIn} = {totalChips.toLocaleString()} ג'יטונים
                    </div>
                  </div>
                  {canManageThisPlayer && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {numBuyIns > 1 && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '6px 8px', fontSize: 12, color: '#f87171' }}
                          onClick={() => removeBuyIn(ls.id, ls.buy_in)}
                          title="הסר קנייה"
                        >−</button>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => addBuyIn(ls.id, ls.buy_in)}
                      >+ קנייה</button>
                    </div>
                  )}
                  {!canManageThisPlayer && canEdit && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', minWidth: 80 }}>
                      רק {players.find(x => x.id === p.id && x.user_id === user?.id) ? 'אתה' : 'בעל החשבון'} יכול
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 90 }}>ג'יטונים סופיים:</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={hasFc ? fc : ''}
                    onChange={e => setFinalChips(s => ({ ...s, [p.id]: e.target.value }))}
                    disabled={!canEdit}
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13, minWidth: 0 }}
                  />
                  {hasFc && (
                    <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {canEdit && (
            <>
              <div style={{ fontSize: 12, textAlign: 'center', margin: '14px 0',
                color: !allChipsEntered ? 'var(--text-muted)' :
                  Math.abs(balance) < 0.5 ? '#22c55e' :
                  Math.abs(balance) < 5 ? '#fbbf24' : '#f87171'
              }}>
                {!allChipsEntered ? (
                  `הזן ג'יטונים סופיים לכל ${livePlayers.length} השחקנים לפני סיום`
                ) : Math.abs(balance) < 0.5 ? (
                  `✓ מאוזן (סה"כ ג'יטונים = סה"כ קופה: ₪${totalBuyIns.toLocaleString()})`
                ) : (
                  `⚠ הפרש: ₪${balance >= 0 ? '+' : ''}${balance.toLocaleString()} (יתכן שחסר/עודף ג'יטון לאיזשהו שחקן)`
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-green" style={{ flex: 1 }} onClick={endGame} disabled={saving}>
                  {saving ? 'שומר...' : '🏁 סיים משחק ושמור'}
                </button>
                <button className="btn btn-ghost" onClick={cancelGame} disabled={saving}>
                  ✕ ביטול
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Other players summary (when not live) */}
      {!isLive && players.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 14 }}>שחקנים בשולחן</div>
          {players.map(p => {
            const ps = sessions.filter(s => s.player_id === p.id && !s.is_live)
            const totalProfit = ps.reduce((a, s) => a + (s.profit || 0), 0)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, cursor: onPlayerClick ? 'pointer' : 'default' }}
                onClick={() => onPlayerClick?.(p)}>
                <div className="avatar" style={{ background: p.color }}>{p.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {ps.length} משחקים
                  </div>
                </div>
                <span className={`badge ${totalProfit > 0 ? 'badge-green' : totalProfit < 0 ? 'badge-red' : 'badge-gold'}`}>
                  {totalProfit >= 0 ? '+' : ''}₪{totalProfit.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Viewers notice */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 20 }}>
        🔗 שתף את הקישור — כולם יכולים לצפות בזמן אמת
        <br />
        <span
          style={{ color: 'var(--red)', cursor: 'pointer', marginTop: 6, display: 'inline-block' }}
          onClick={() => { navigator.clipboard.writeText(window.location.href); alert('הקישור הועתק!') }}
        >
          העתק קישור לשולחן
        </span>
      </div>

      {/* Start game modal */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowStartModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 8 }}>משחק חדש</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              קנייה התחלתית לכל שחקן: ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים<br/>
              בחר את המשתתפים:
            </div>
            {/* Add new player inline */}
            {canEdit && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  placeholder="שם שחקן חדש..."
                  onKeyDown={e => e.key === 'Enter' && addNewPlayer()}
                  style={{ flex: 1, fontSize: 13, padding: '7px 10px' }}
                />
                <button
                  className="btn btn-gold"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={addNewPlayer}
                  disabled={!newPlayerName.trim() || addingPlayer}
                >
                  {addingPlayer ? '...' : '+ הוסף'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setSelectedPlayers(players.map(p => p.id))}>
                בחר הכל
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setSelectedPlayers([])}>
                בטל הכל
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {players.map(p => {
                const checked = selectedPlayers.includes(p.id)
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8, cursor: 'pointer', background: checked ? 'rgba(220,38,38,0.08)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedPlayers(s => checked ? s.filter(x => x !== p.id) : [...s, p.id])}
                    />
                    <div className="avatar" style={{ background: p.color, width: 32, height: 32, fontSize: 14 }}>{p.name[0]}</div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                  </label>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              סה"כ קופה התחלתית: ₪{(buyInAmount * selectedPlayers.length).toLocaleString()} ({(chipsPerBuyin * selectedPlayers.length).toLocaleString()} ג'יטונים)
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-red" style={{ flex: 1 }} onClick={startGame} disabled={selectedPlayers.length === 0 || saving}>
                {saving ? 'מתחיל...' : `▶ התחל משחק (${selectedPlayers.length})`}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowStartModal(false)} disabled={saving}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 16 }}>הגדרות משחק</h2>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>סכום קנייה (₪)</label>
              <input
                type="number"
                value={settingsForm.buy_in_amount}
                onChange={e => setSettingsForm(f => ({ ...f, buy_in_amount: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>ג'יטונים לקנייה</label>
              <input
                type="number"
                value={settingsForm.chips_per_buyin}
                onChange={e => setSettingsForm(f => ({ ...f, chips_per_buyin: e.target.value }))}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              ערך ג'יטון: ₪{(Number(settingsForm.buy_in_amount) / Math.max(1, Number(settingsForm.chips_per_buyin))).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-red" style={{ flex: 1 }} onClick={saveSettings}>שמור</button>
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
