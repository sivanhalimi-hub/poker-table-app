import { useMemo, useState } from 'react'

export default function GameHistoryModal({ table, players, sessions, onClose, onPlayerClick }) {
  const [expanded, setExpanded] = useState({})

  // Group sessions by date (exclude live ones)
  const gamesByDate = useMemo(() => {
    const groups = {}
    for (const s of sessions) {
      if (s.is_live) continue
      if (!groups[s.date]) groups[s.date] = []
      groups[s.date].push(s)
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => {
        const totalBuyIn = items.reduce((a, x) => a + Number(x.buy_in || 0), 0)
        const totalProfit = items.reduce((a, x) => a + Number(x.profit || 0), 0)
        const hours = items[0]?.hours || 0
        return { date, items, totalBuyIn, totalProfit, hours }
      })
  }, [sessions])

  function playerById(pid) { return players.find(p => p.id === pid) }
  function toggle(date) { setExpanded(s => ({ ...s, [date]: !s[date] })) }

  // Aggregate totals across all games
  const allTimeStats = useMemo(() => {
    const totalPot = sessions.filter(s => !s.is_live).reduce((a, s) => a + Number(s.buy_in || 0), 0)
    const games = gamesByDate.length
    const totalHours = gamesByDate.reduce((a, g) => a + g.hours, 0)
    return { totalPot, games, totalHours }
  }, [sessions, gamesByDate])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 6, textAlign: 'center' }}>
          📜 היסטוריית משחקים
        </h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 14 }}>
          {table.name}
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>סה"כ משחקים</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{allTimeStats.games}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>סה"כ קופות</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>₪{allTimeStats.totalPot.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>סה"כ שעות</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{allTimeStats.totalHours}ש'</div>
          </div>
        </div>

        {/* Games list (scrollable) */}
        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 14, marginInline: -4, paddingInline: 4 }}>
          {gamesByDate.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>♠</div>
              אין עדיין משחקים בהיסטוריה.<br/>
              <span style={{ fontSize: 11 }}>סיים משחק חי כדי שיופיע כאן</span>
            </div>
          ) : gamesByDate.map(g => {
            const isOpen = expanded[g.date]
            const sortedItems = [...g.items].sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0))
            const winner = sortedItems[0]
            const winnerPlayer = winner ? playerById(winner.player_id) : null
            return (
              <div key={g.date} style={{
                background: 'var(--bg3)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
                border: '1px solid var(--border)',
              }}>
                {/* Date header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggle(g.date)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Playfair Display' }}>
                      {new Date(g.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {g.items.length} שחקנים · קופה ₪{g.totalBuyIn.toLocaleString()}
                      {g.hours > 0 && ` · ${g.hours}ש'`}
                    </div>
                  </div>
                  {winnerPlayer && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,134,11,0.1))',
                      border: '1px solid rgba(212,175,55,0.4)',
                      borderRadius: 99, padding: '3px 8px',
                      fontSize: 11,
                    }}>
                      <span>🥇</span>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: winnerPlayer.color, display: 'inline-block' }} />
                      <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                        {winnerPlayer.name} +₪{Math.round(winner.profit)}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: 16, color: 'var(--text-muted)', marginRight: 6 }}>{isOpen ? '▾' : '◂'}</div>
                </div>

                {/* Chips row (always visible) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {sortedItems.map(s => {
                    const profit = Number(s.profit || 0)
                    const p = playerById(s.player_id)
                    if (!p) return null
                    return (
                      <div
                        key={s.id}
                        onClick={(e) => { e.stopPropagation(); onPlayerClick?.(p); }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 99,
                          background: profit > 0
                            ? 'rgba(22,163,74,0.18)'
                            : profit < 0
                            ? 'rgba(220,38,38,0.18)'
                            : 'rgba(217,119,6,0.18)',
                          border: `1px solid ${profit > 0 ? 'rgba(22,163,74,0.4)' : profit < 0 ? 'rgba(220,38,38,0.4)' : 'rgba(217,119,6,0.4)'}`,
                          cursor: onPlayerClick ? 'pointer' : 'default',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        <span>{p.name}</span>
                        <span style={{ color: profit > 0 ? '#4ade80' : profit < 0 ? '#f87171' : '#fbbf24' }}>
                          {profit >= 0 ? '+' : ''}{Math.round(profit)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Expanded: full details */}
                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {sortedItems.map((s, i) => {
                      const profit = Number(s.profit || 0)
                      const p = playerById(s.player_id)
                      if (!p) return null
                      return (
                        <div key={s.id}
                          onClick={(e) => { e.stopPropagation(); onPlayerClick?.(p); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border)',
                            cursor: onPlayerClick ? 'pointer' : 'default',
                          }}>
                          <div style={{ fontSize: 12, width: 22, textAlign: 'center', opacity: i < 3 ? 1 : 0.4 }}>
                            {['🥇','🥈','🥉'][i] || `${i+1}`}
                          </div>
                          <div className="avatar" style={{ background: p.color, width: 26, height: 26, fontSize: 11 }}>
                            {p.name[0]}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              ₪{s.buy_in} → ₪{s.cash_out}
                              {s.final_chips > 0 && ` · ${s.final_chips} ג'יטונים`}
                            </div>
                          </div>
                          <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 11 }}>
                            {profit >= 0 ? '+' : ''}₪{Math.round(profit).toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                    {g.items.some(s => s.notes) && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        📝 {g.items.map(s => s.notes).filter(Boolean).join(' | ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button className="btn btn-red btn-block" onClick={onClose}>סגור</button>
      </div>
    </div>
  )
}
