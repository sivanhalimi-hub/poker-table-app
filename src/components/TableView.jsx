import { useEffect, useState } from 'react'

// Position 9 seats around an oval poker table
// Returns { top, left } in % for each seat index (0-8)
function getSeatPosition(index, total) {
  // Angles distributed around the oval, starting from top-center going clockwise
  // We avoid placing seats directly at 0/180 (left/right edges) for a more realistic poker layout
  const angles = total === 9
    ? [-90, -50, -20, 20, 50, 90, 140, 180, 220].map(a => (a * Math.PI) / 180)
    : Array.from({ length: total }, (_, i) => ((i / total) * 2 * Math.PI) - Math.PI / 2)
  const a = angles[index] ?? 0
  // Oval radii (relative to container)
  const rx = 48 // horizontal radius %
  const ry = 38 // vertical radius %
  const cx = 50
  const cy = 50
  return {
    left: cx + rx * Math.cos(a),
    top: cy + ry * Math.sin(a),
  }
}

export default function TableView({ table, players, sessions, canEdit, user, onPlayerClick, onStartGame }) {
  const isLive = !!table.is_live
  const [elapsed, setElapsed] = useState('00:00')

  useEffect(() => {
    if (!isLive || !table.live_start) { setElapsed('00:00'); return }
    const start = new Date(table.live_start)
    const tick = () => {
      const diff = Date.now() - start.getTime()
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
      setElapsed(`${h}:${m}`)
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [isLive, table.live_start])

  // Seat assignment: first 9 players from the players array (sorted by created_at)
  const seats = players.slice(0, 9)
  const overflowPlayers = players.slice(9)

  // Live session lookup
  const liveSessions = sessions.filter(s => s.is_live)
  function liveSessionFor(pid) { return liveSessions.find(s => s.player_id === pid) }

  // Total profit per player
  function netProfit(pid) {
    return sessions.filter(s => s.player_id === pid && !s.is_live)
      .reduce((a, s) => a + Number(s.profit || 0), 0)
  }

  const buyInAmount = Number(table.buy_in_amount || 50)
  const chipsPerBuyin = Number(table.chips_per_buyin || 200)

  const totalPot = liveSessions.reduce((a, s) => a + Number(s.buy_in || 0), 0)

  return (
    <div>
      {/* Poker table visual */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        maxWidth: 720,
        margin: '0 auto 24px',
        minHeight: 280,
      }}>
        {/* The oval table */}
        <div style={{
          position: 'absolute',
          inset: '8% 4%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, #1a6840 0%, #0f4527 60%, #0a3320 100%)',
          border: '6px solid #4a3b1f',
          boxShadow: `
            inset 0 0 60px rgba(0,0,0,0.7),
            inset 0 4px 0 rgba(255,255,255,0.05),
            0 12px 40px rgba(0,0,0,0.6),
            0 0 0 2px rgba(212,175,55,0.3)
          `,
          backgroundImage: `
            radial-gradient(ellipse at center, #1a6840 0%, #0f4527 60%, #0a3320 100%),
            repeating-radial-gradient(circle at center, transparent 0, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)
          `,
        }}>
          {/* Inner felt accent ring */}
          <div style={{
            position: 'absolute',
            inset: '12%',
            border: '1px solid rgba(212,175,55,0.18)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Center info */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#f0e6d3',
          zIndex: 1,
          padding: '0 20px',
        }}>
          {isLive ? (
            <>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
                <span className="live-dot" style={{ marginLeft: 4 }} /> LIVE
              </div>
              <div style={{
                fontSize: 36,
                fontWeight: 900,
                fontFamily: 'Playfair Display',
                color: '#fbbf24',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                letterSpacing: 2,
              }}>
                {elapsed}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.6)', marginTop: 2 }}>
                קופה: ₪{totalPot.toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.8 }}>♠ ♥ ♦ ♣</div>
              <div style={{ fontSize: 13, color: 'rgba(240,230,211,0.7)', fontWeight: 600 }}>
                {seats.length} {seats.length === 1 ? 'שחקן' : 'שחקנים'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.5)', marginTop: 2 }}>
                ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים
              </div>
              {canEdit && players.length > 0 && onStartGame && (
                <button
                  className="btn btn-red"
                  onClick={onStartGame}
                  style={{ marginTop: 10, fontSize: 12, padding: '6px 14px' }}
                >
                  ▶ התחל משחק
                </button>
              )}
            </>
          )}
        </div>

        {/* Seats */}
        {seats.map((p, i) => {
          const pos = getSeatPosition(i, Math.max(seats.length, isLive ? seats.length : 9))
          const ls = liveSessionFor(p.id)
          const total = netProfit(p.id)
          const isMine = user && p.user_id === user.id
          return (
            <div
              key={p.id}
              onClick={() => onPlayerClick?.(p)}
              style={{
                position: 'absolute',
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                transform: 'translate(-50%, -50%)',
                cursor: onPlayerClick ? 'pointer' : 'default',
                zIndex: 2,
                textAlign: 'center',
                width: 90,
              }}
            >
              {/* Avatar */}
              <div className="avatar"
                style={{
                  background: p.color,
                  width: 52, height: 52, fontSize: 18,
                  margin: '0 auto',
                  border: isMine ? '2px solid #fbbf24' : undefined,
                  boxShadow: isMine
                    ? 'inset 0 0 0 3px rgba(255,255,255,0.25), inset 0 0 0 4px rgba(0,0,0,0.3), 0 0 0 2px #fbbf24, 0 6px 14px rgba(212,175,55,0.4)'
                    : undefined,
                }}>
                {p.name[0]}
              </div>
              {/* Name plate */}
              <div style={{
                marginTop: 4,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 8,
                padding: '3px 6px',
                border: '1px solid rgba(212,175,55,0.25)',
                fontSize: 11,
                fontWeight: 700,
                color: '#f0e6d3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 90,
              }}>
                {isMine && '★ '}{p.name}
              </div>
              {/* Chips / total */}
              {isLive && ls ? (
                <div style={{
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fbbf24',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}>
                  🪙 {((Number(ls.buy_in || 0) / buyInAmount) * chipsPerBuyin).toLocaleString()}
                </div>
              ) : (
                total !== 0 && (
                  <div style={{
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: total > 0 ? '#4ade80' : '#f87171',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}>
                    {total >= 0 ? '+' : ''}₪{total.toLocaleString()}
                  </div>
                )
              )}
              {/* Live badge if in current game */}
              {isLive && ls && (
                <div style={{
                  position: 'absolute',
                  top: -6, right: -6,
                  background: '#dc2626',
                  borderRadius: '50%',
                  width: 12, height: 12,
                  border: '2px solid #0f4527',
                  animation: 'pulse 1.5s infinite',
                }} />
              )}
            </div>
          )
        })}

        {/* Empty seats placeholder when no players */}
        {seats.length === 0 && canEdit && (
          <div style={{
            position: 'absolute',
            left: '50%', top: '85%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            fontSize: 12,
            color: 'rgba(240,230,211,0.6)',
          }}>
            הוסף שחקנים בלשונית 👥 שחקנים
          </div>
        )}
      </div>

      {/* Overflow players */}
      {overflowPlayers.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
            שחקנים נוספים ({overflowPlayers.length}) - מעבר ל-9 המושבים בשולחן
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {overflowPlayers.map(p => (
              <div
                key={p.id}
                onClick={() => onPlayerClick?.(p)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 99,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick info card */}
      <div className="card" style={{ textAlign: 'center', fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          {isLive ? '🎮 משחק פעיל - עבור ללשונית "● חי" לעדכון קניות וסיום' : '📅 אין משחק פעיל כרגע'}
        </div>
        {!isLive && players.length === 0 && canEdit && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            התחל בלהוסיף שחקנים, ואז התחל משחק חדש בלשונית "● חי"
          </div>
        )}
      </div>
    </div>
  )
}
