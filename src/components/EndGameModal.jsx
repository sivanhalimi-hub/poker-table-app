import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EndGameModal({ table, players, liveSessions, onClose, onEnded }) {
  const [finalChips, setFinalChips] = useState({})
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('input') // 'input' or 'summary'
  const [endedSessions, setEndedSessions] = useState([])

  const buyInAmount = Number(table.buy_in_amount || 50)
  const chipsPerBuyin = Number(table.chips_per_buyin || 200)
  const chipValue = chipsPerBuyin > 0 ? buyInAmount / chipsPerBuyin : 0

  const livePlayers = liveSessions
    .map(ls => ({ session: ls, player: players.find(p => p.id === ls.player_id) }))
    .filter(x => x.player)

  const totalBuyIns = liveSessions.reduce((a, s) => a + Number(s.buy_in || 0), 0)
  const totalChipsValue = livePlayers.reduce((a, x) => {
    const v = finalChips[x.player.id]
    if (v === undefined || v === '') return a
    return a + Number(v) * chipValue
  }, 0)
  const allEntered = livePlayers.every(x => finalChips[x.player.id] !== undefined && finalChips[x.player.id] !== '')
  const balance = Math.round((totalChipsValue - totalBuyIns) * 100) / 100

  async function confirmEnd() {
    const missing = livePlayers.filter(x => finalChips[x.player.id] === undefined || finalChips[x.player.id] === '')
    if (missing.length > 0) {
      const names = missing.map(x => x.player.name).join(', ')
      if (!confirm(`לא הוזנו ג'יטונים סופיים עבור: ${names}\nלסיים בכל זאת? (יקבלו 0 ג'יטונים)`)) return
    }
    setSaving(true)
    const hours = table.live_start
      ? Number(((Date.now() - new Date(table.live_start).getTime()) / 3600000).toFixed(2))
      : 0

    const ended = []
    for (const x of livePlayers) {
      const chips = Number(finalChips[x.player.id] || 0)
      const cash_out = Math.round((chips * chipValue) * 100) / 100
      const buy_in = Number(x.session.buy_in || 0)
      await supabase.from('sessions').update({
        cash_out,
        final_chips: chips,
        hours,
        is_live: false,
      }).eq('id', x.session.id)
      ended.push({
        player: x.player,
        buy_in,
        cash_out,
        chips,
        profit: cash_out - buy_in,
      })
    }
    await supabase.from('tables').update({ is_live: false, live_start: null }).eq('id', table.id)

    setEndedSessions(ended.sort((a, b) => b.profit - a.profit))
    setSaving(false)
    setView('summary')
    onEnded?.()
  }

  async function cancelGame() {
    if (!confirm('לבטל את המשחק? כל הקניות והנתונים מהמשחק הזה יימחקו (לא יישמר בהיסטוריה).')) return
    setSaving(true)
    for (const x of livePlayers) {
      await supabase.from('sessions').delete().eq('id', x.session.id)
    }
    await supabase.from('tables').update({ is_live: false, live_start: null }).eq('id', table.id)
    setSaving(false)
    onClose()
  }

  if (view === 'summary') {
    const winners = endedSessions.filter(s => s.profit > 0)
    const losers = endedSessions.filter(s => s.profit < 0)
    const totalProfit = endedSessions.reduce((a, s) => a + s.profit, 0)
    return (
      <div className="modal-overlay">
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
          <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 6, textAlign: 'center' }}>
            🏆 סיכום משחק
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            {endedSessions[0]?.hours > 0 && ` · ${endedSessions[0].hours}ש'`}
          </div>

          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>קופה</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>₪{totalBuyIns.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>שחקנים</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{endedSessions.length}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>איזון</div>
              <div style={{
                fontSize: 16, fontWeight: 800,
                color: Math.abs(totalProfit) < 0.5 ? '#22c55e' : Math.abs(totalProfit) < 5 ? '#fbbf24' : '#f87171',
              }}>
                {totalProfit >= 0 ? '+' : ''}₪{Math.round(totalProfit).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>דירוג</div>
          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
            {endedSessions.map((s, i) => (
              <div key={s.player.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 10, marginBottom: 6,
                background: i === 0
                  ? 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,134,11,0.08))'
                  : 'var(--bg3)',
                borderRadius: 10,
                border: i === 0 ? '1px solid rgba(212,175,55,0.5)' : '1px solid var(--border)',
                borderRight: `3px solid ${s.player.color}`,
              }}>
                <div style={{ fontSize: 18, width: 26, textAlign: 'center' }}>
                  {['🥇','🥈','🥉'][i] || `${i+1}.`}
                </div>
                <div className="avatar" style={{ background: s.player.color, width: 34, height: 34, fontSize: 13 }}>
                  {s.player.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.player.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    קנייה ₪{s.buy_in} · {s.chips} ג'יטונים = ₪{s.cash_out}
                  </div>
                </div>
                <span className={`badge ${s.profit > 0 ? 'badge-green' : s.profit < 0 ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {s.profit >= 0 ? '+' : ''}₪{Math.round(s.profit).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Settle-up suggestion */}
          {winners.length > 0 && losers.length > 0 && (
            <div style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 14,
              fontSize: 12,
              color: 'rgba(240,230,211,0.75)',
            }}>
              💸 <span style={{ fontWeight: 700 }}>למי משלמים?</span><br/>
              {losers.map(l => {
                return `${l.player.name} משלם ₪${Math.abs(Math.round(l.profit))}`
              }).join(' · ')}
            </div>
          )}

          <button className="btn btn-red btn-block" onClick={onClose}>סגור</button>
        </div>
      </div>
    )
  }

  // Input view
  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 6 }}>🏁 סיום משחק</h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          הזן את כמות הג'יטונים שיש לכל שחקן בסיום
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
          {livePlayers.map(({ session: ls, player: p }) => {
            const totalBuyIn = Number(ls.buy_in || 0)
            const numBuyIns = Math.round(totalBuyIn / buyInAmount)
            const fc = finalChips[p.id]
            const hasFc = fc !== undefined && fc !== ''
            const profit = hasFc ? Math.round((Number(fc) * chipValue - totalBuyIn) * 100) / 100 : null
            return (
              <div key={p.id} style={{
                background: 'var(--bg3)',
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                borderRight: `3px solid ${p.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="avatar" style={{ background: p.color, width: 32, height: 32, fontSize: 13 }}>
                    {p.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {numBuyIns} {numBuyIns === 1 ? 'קנייה' : 'קניות'} · ₪{totalBuyIn}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="0"
                    value={hasFc ? fc : ''}
                    onChange={e => setFinalChips(s => ({ ...s, [p.id]: e.target.value }))}
                    style={{ flex: 1, fontSize: 14, padding: '8px 10px' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ג'יטונים</span>
                  {hasFc && (
                    <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 11, minWidth: 60, textAlign: 'center' }}>
                      {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Balance check */}
        <div style={{
          fontSize: 12, textAlign: 'center', margin: '10px 0',
          color: !allEntered ? 'var(--text-muted)' :
            Math.abs(balance) < 0.5 ? '#22c55e' :
            Math.abs(balance) < 5 ? '#fbbf24' : '#f87171',
        }}>
          {!allEntered ? (
            `הזן ג'יטונים לכל ${livePlayers.length} השחקנים`
          ) : Math.abs(balance) < 0.5 ? (
            `✓ מאוזן: סה"כ ג'יטונים ₪${Math.round(totalChipsValue)} = סה"כ קופה ₪${totalBuyIns}`
          ) : (
            `⚠ הפרש: ${balance >= 0 ? '+' : ''}₪${Math.round(balance)} (חסר/עודף ג'יטון לאיזשהו שחקן)`
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-green" style={{ flex: 1 }} onClick={confirmEnd} disabled={saving}>
            {saving ? 'שומר...' : '🏁 סיים ושמור'}
          </button>
          <button className="btn btn-ghost" onClick={cancelGame} disabled={saving} style={{ color: '#f87171' }}>
            ✕ בטל
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>סגור</button>
        </div>
      </div>
    </div>
  )
}
