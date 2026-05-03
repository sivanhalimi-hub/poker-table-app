import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function LiveTab({ tableId, players, sessions, isOwner, table, onRefresh }) {
  const [startTime, setStartTime] = useState(table.live_start ? new Date(table.live_start) : null)
  const [elapsed, setElapsed] = useState('00:00')
  const [stacks, setStacks] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!startTime) return
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

  async function startGame() {
    const now = new Date().toISOString()
    await supabase.from('tables').update({ is_live: true, live_start: now }).eq('id', tableId)
    setStartTime(new Date(now))
    onRefresh()
  }

  async function endGame() {
    if (!confirm('לסיים את המשחק? תוכל להוסיף את התוצאות ידנית.')) return
    await supabase.from('tables').update({ is_live: false, live_start: null }).eq('id', tableId)
    setStartTime(null)
    onRefresh()
  }

  async function saveStacks() {
    if (Object.keys(stacks).length === 0) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const hours = startTime ? ((Date.now() - startTime.getTime()) / 3600000).toFixed(1) : 0

    for (const [pid, stack] of Object.entries(stacks)) {
      if (stack === '' || stack === undefined) continue
      const existing = sessions.find(s => s.player_id === pid && s.date === today && s.cash_out === 0)
      if (existing) {
        await supabase.from('sessions').update({ cash_out: Number(stack), hours: Number(hours) }).eq('id', existing.id)
      }
    }
    setSaving(false)
    setStacks({})
    onRefresh()
    alert('הסטאקים עודכנו!')
  }

  const isLive = table.is_live

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
            {isOwner && (
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={endGame}>
                ⏹ סיים משחק
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>♠</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 16 }}>
              {players.length === 0 ? 'הוסף שחקנים תחילה' : 'אין משחק פעיל כרגע'}
            </div>
            {isOwner && players.length > 0 && (
              <button className="btn btn-red" style={{ fontSize: 15, padding: '12px 28px' }} onClick={startGame}>
                ▶ התחל משחק
              </button>
            )}
          </>
        )}
      </div>

      {/* Players current stacks */}
      {players.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 14 }}>שחקנים בשולחן</div>
          {players.map(p => {
            const ps = sessions.filter(s => s.player_id === p.id)
            const totalProfit = ps.reduce((a, s) => a + (s.profit || 0), 0)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="avatar" style={{ background: p.color }}>{p.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {ps.length} משחקים
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${totalProfit > 0 ? 'badge-green' : totalProfit < 0 ? 'badge-red' : 'badge-gold'}`}>
                    {totalProfit >= 0 ? '+' : ''}₪{totalProfit.toLocaleString()}
                  </span>
                  {isLive && isOwner && (
                    <input
                      type="number"
                      placeholder="סטאק"
                      value={stacks[p.id] || ''}
                      onChange={e => setStacks(s => ({ ...s, [p.id]: e.target.value }))}
                      style={{ width: 80, padding: '6px 10px', fontSize: 13 }}
                    />
                  )}
                </div>
              </div>
            )
          })}
          {isLive && isOwner && Object.values(stacks).some(v => v !== '') && (
            <button className="btn btn-green btn-block" style={{ marginTop: 10 }} onClick={saveStacks} disabled={saving}>
              {saving ? 'שומר...' : '💾 עדכן סטאקים'}
            </button>
          )}
        </div>
      )}

      {/* Viewers notice */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 20 }}>
        🔗 שתף את הקישור לעמוד זה — כולם יכולים לצפות בזמן אמת
        <br />
        <span
          style={{ color: 'var(--red)', cursor: 'pointer', marginTop: 6, display: 'inline-block' }}
          onClick={() => { navigator.clipboard.writeText(window.location.href); alert('הקישור הועתק!') }}
        >
          העתק קישור לשולחן
        </span>
      </div>
    </div>
  )
}
