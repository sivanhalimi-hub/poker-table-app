import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import EndGameModal from './EndGameModal'
import GameHistoryModal from './GameHistoryModal'

const NUM_SEATS = 9

// Generate seat positions around an oval. Seat 1 at top-left, going clockwise.
function getSeatPosition(seatNumber) {
  // Distribute 9 seats around the oval
  // Top row: seats 1-2-3 (top-left, top-center, top-right)
  // Right side: seats 4-5
  // Bottom row: seats 6-7-8 (bottom-right, bottom-center, bottom-left)
  // Left side: seat 9
  const angles = {
    1: -135, 2: -90,  3: -45,
    4: 0,
    5: 45,  6: 90,   7: 135,
    8: 180,
    9: -180,
  }
  // Reorder for visual symmetry
  const map = {
    1: -120, // top-left
    2: -90,  // top-center
    3: -60,  // top-right
    4: -10,  // upper-right
    5: 50,   // lower-right
    6: 90,   // bottom-center
    7: 130,  // lower-left
    8: -170, // upper-left (= 190)
    9: 180,  // left
  }
  const a = ((map[seatNumber] || 0) * Math.PI) / 180
  const rx = 47, ry = 40, cx = 50, cy = 50
  return {
    left: cx + rx * Math.cos(a),
    top: cy + ry * Math.sin(a),
  }
}

export default function TableView({ table, players, sessions, canEdit, user, onPlayerClick, onStartGame }) {
  const isLive = !!table.is_live
  const [elapsed, setElapsed] = useState('00:00')
  const [showClaimModal, setShowClaimModal] = useState(null) // { seat: N }
  const [claimMode, setClaimMode] = useState('new') // 'new' or 'existing'
  const [newPlayerName, setNewPlayerName] = useState('')
  const [selectedExisting, setSelectedExisting] = useState('')
  const [working, setWorking] = useState(false)
  const [showEndGame, setShowEndGame] = useState(false)
  const [showLastSummary, setShowLastSummary] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

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

  const liveSessions = sessions.filter(s => s.is_live)
  function liveSessionFor(pid) { return liveSessions.find(s => s.player_id === pid) }
  function netProfit(pid) {
    return sessions.filter(s => s.player_id === pid && !s.is_live)
      .reduce((a, s) => a + Number(s.profit || 0), 0)
  }

  const buyInAmount = Number(table.buy_in_amount || 50)
  const chipsPerBuyin = Number(table.chips_per_buyin || 200)
  const totalPot = liveSessions.reduce((a, s) => a + Number(s.buy_in || 0), 0)

  // Build seat map: seat number -> player (or null)
  const seatedPlayers = {}
  for (const p of players) {
    if (p.seat && p.seat >= 1 && p.seat <= NUM_SEATS) {
      seatedPlayers[p.seat] = p
    }
  }
  const unseatedPlayers = players.filter(p => !p.seat || p.seat < 1 || p.seat > NUM_SEATS)

  const myPlayer = players.find(p => p.user_id === user?.id)
  const COLORS = ['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#65a30d','#f97316','#84cc16','#facc15','#a855f7']

  function openClaimSeat(seat) {
    setShowClaimModal({ seat })
    setClaimMode(unseatedPlayers.length > 0 ? 'existing' : 'new')
    setNewPlayerName(user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || '')
    setSelectedExisting(myPlayer && !myPlayer.seat ? myPlayer.id : (unseatedPlayers[0]?.id || ''))
  }

  async function claimSeat() {
    if (!showClaimModal || !user) return
    const seat = showClaimModal.seat
    setWorking(true)
    if (claimMode === 'new') {
      const name = newPlayerName.trim()
      if (!name) { setWorking(false); return }
      const usedColors = players.map(p => p.color)
      const color = COLORS.find(c => !usedColors.includes(c)) || COLORS[players.length % COLORS.length]
      // If user already has a claimed player, just create another one without linking (since user can only own one)
      const newRow = {
        table_id: table.id,
        name,
        color,
        seat,
        ...(myPlayer ? {} : { user_id: user.id }), // claim ownership only if user has no player yet
      }
      await supabase.from('players').insert(newRow)
    } else if (claimMode === 'existing') {
      if (!selectedExisting) { setWorking(false); return }
      // Vacate any other seat held by this player
      await supabase.from('players').update({ seat }).eq('id', selectedExisting)
    }
    setWorking(false)
    setShowClaimModal(null)
  }

  async function leaveSeat(player) {
    if (!confirm(`לקום מהמושב? ${player.name} יחזור לרשימת השחקנים ללא מקום בשולחן.`)) return
    await supabase.from('players').update({ seat: null }).eq('id', player.id)
  }

  function canManagePlayer(p) {
    if (!user) return false
    if (user.id === table.owner_id) return true
    if (!p.user_id) return true
    return p.user_id === user.id
  }

  // Add buy-in to a live session
  async function addBuyIn(session) {
    await supabase.from('sessions').update({
      buy_in: Number(session.buy_in || 0) + buyInAmount
    }).eq('id', session.id)
  }
  async function removeBuyIn(session) {
    const newAmount = Math.max(buyInAmount, Number(session.buy_in || 0) - buyInAmount)
    await supabase.from('sessions').update({ buy_in: newAmount }).eq('id', session.id)
  }

  // Start a new live game with all seated players, then optionally add an extra buy-in for one specific player
  async function startGameWithBuyIn(playerWithExtra) {
    const seatedList = Object.values(seatedPlayers)
    if (seatedList.length === 0) return
    if (!confirm(`להתחיל משחק חדש? כל ${seatedList.length} השחקנים בשולחן יצטרפו עם קנייה התחלתית של ₪${buyInAmount}.${playerWithExtra ? `\n${playerWithExtra.name} יקבל קנייה נוספת.` : ''}`)) return

    const now = new Date().toISOString()
    const today = now.split('T')[0]
    const rows = seatedList.map(p => ({
      table_id: table.id,
      player_id: p.id,
      date: today,
      buy_in: p.id === playerWithExtra?.id ? buyInAmount * 2 : buyInAmount,
      cash_out: 0,
      hours: 0,
      is_live: true,
    }))
    await supabase.from('sessions').insert(rows)
    await supabase.from('tables').update({ is_live: true, live_start: now }).eq('id', table.id)
  }

  return (
    <div>
      {/* Realistic poker table */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '5 / 3',
        maxWidth: 760,
        margin: '0 auto 24px',
        minHeight: 320,
      }}>
        {/* Wooden rim (outer) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `
            radial-gradient(ellipse at 30% 30%, #a87447 0%, #8b5a2b 35%, #5a3a1a 80%, #3d2810 100%)
          `,
          boxShadow: `
            0 18px 40px rgba(0,0,0,0.7),
            inset 0 4px 0 rgba(255,255,255,0.08),
            inset 0 -6px 12px rgba(0,0,0,0.4)
          `,
          backgroundImage: `
            radial-gradient(ellipse at 30% 30%, #a87447 0%, #8b5a2b 35%, #5a3a1a 80%, #3d2810 100%),
            repeating-linear-gradient(85deg, transparent 0, transparent 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 8px)
          `,
        }} />

        {/* Inner railing accent */}
        <div style={{
          position: 'absolute',
          inset: '6%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #2a2a2a, #1a1a1a)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.2)',
        }} />

        {/* Green felt */}
        <div style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, #1a7a48 0%, #0e5530 60%, #084221 100%)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), inset 0 4px 12px rgba(0,0,0,0.3)',
          backgroundImage: `
            radial-gradient(ellipse at center, #1a7a48 0%, #0e5530 60%, #084221 100%),
            repeating-radial-gradient(circle at center, transparent 0, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)
          `,
        }}>
          {/* Inner felt accent ring */}
          <div style={{
            position: 'absolute',
            inset: '14%',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 1,
          padding: '0 20px',
          maxWidth: '60%',
        }}>
          {isLive ? (
            <>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>
                <span className="live-dot" style={{ marginLeft: 4 }} /> LIVE
              </div>
              <div style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: 'Playfair Display',
                color: '#fbbf24',
                textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                letterSpacing: 2,
              }}>
                {elapsed}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.7)', marginTop: 2, marginBottom: 8, fontWeight: 600 }}>
                🪙 קופה: ₪{totalPot.toLocaleString()}
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowEndGame(true)}
                  style={{
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 22,
                    padding: '7px 16px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    letterSpacing: 0.5,
                  }}
                >
                  🏁 סיים סשן
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{
                fontFamily: 'Playfair Display',
                fontSize: 22,
                fontWeight: 700,
                color: 'rgba(212,175,55,0.85)',
                letterSpacing: 3,
                textShadow: '0 2px 6px rgba(0,0,0,0.5)',
                lineHeight: 1.1,
              }}>
                {table.name}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(240,230,211,0.6)', marginTop: 6, letterSpacing: 1.5 }}>
                NO LIMIT HOLD'EM
              </div>
              <div style={{ fontSize: 10, color: 'rgba(240,230,211,0.45)', marginTop: 4 }}>
                ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים
              </div>
              {canEdit && Object.keys(seatedPlayers).length > 0 && (
                <button
                  className="btn btn-red"
                  onClick={() => startGameWithBuyIn(null)}
                  style={{ marginTop: 10, fontSize: 11, padding: '5px 12px' }}
                >
                  ▶ התחל משחק
                </button>
              )}
            </>
          )}
        </div>

        {/* Seats */}
        {Array.from({ length: NUM_SEATS }, (_, i) => i + 1).map(seatNum => {
          const pos = getSeatPosition(seatNum)
          const p = seatedPlayers[seatNum]
          const ls = p ? liveSessionFor(p.id) : null
          const isMine = p && user && p.user_id === user.id

          return (
            <div
              key={seatNum}
              style={{
                position: 'absolute',
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
                width: 92,
                textAlign: 'center',
              }}
            >
              {p ? (
                <>
                  {/* Filled seat: player avatar */}
                  <div
                    onClick={() => onPlayerClick?.(p)}
                    style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                  >
                    <div className="avatar"
                      style={{
                        background: p.color,
                        width: 50, height: 50, fontSize: 18,
                        margin: '0 auto',
                        border: isMine ? '3px solid #fbbf24' : undefined,
                        boxShadow: isMine
                          ? 'inset 0 0 0 3px rgba(255,255,255,0.25), 0 0 0 2px #fbbf24, 0 6px 16px rgba(212,175,55,0.5)'
                          : 'inset 0 0 0 3px rgba(255,255,255,0.2), inset 0 0 0 4px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.5)',
                      }}>
                      {p.name[0]}
                    </div>
                  </div>
                  {/* Name plate + inline + button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 4,
                    justifyContent: 'center',
                  }}>
                    <div
                      onClick={() => onPlayerClick?.(p)}
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: 8,
                        padding: '3px 6px',
                        border: '1px solid rgba(212,175,55,0.3)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#f0e6d3',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 64,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        cursor: onPlayerClick ? 'pointer' : 'default',
                        flex: 1,
                      }}>
                      {isMine && '★'}{p.name}
                    </div>
                    {canEdit && canManagePlayer(p) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isLive && ls) addBuyIn(ls)
                          else startGameWithBuyIn(p)
                        }}
                        title={`+ קנייה (₪${buyInAmount})`}
                        style={{
                          background: 'linear-gradient(135deg, #fbbf24, #d4af37)',
                          border: '1px solid rgba(0,0,0,0.4)',
                          color: '#1a0c00',
                          width: 22, height: 22,
                          borderRadius: '50%',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: 'pointer',
                          lineHeight: 1,
                          padding: 0,
                          boxShadow: '0 3px 8px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >+</button>
                    )}
                  </div>

                  {/* Chip stack / profit indicator */}
                  {isLive && ls ? (
                    <>
                      <div style={{
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fbbf24',
                        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                      }}>
                        🪙 {((Number(ls.buy_in || 0) / buyInAmount) * chipsPerBuyin).toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: 9,
                        color: 'rgba(240,230,211,0.6)',
                        marginTop: 1,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}>
                        {Math.round(Number(ls.buy_in || 0) / buyInAmount)}× ₪{ls.buy_in}
                        {canManagePlayer(p) && Math.round(Number(ls.buy_in || 0) / buyInAmount) > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeBuyIn(ls) }}
                            title="הסר קנייה"
                            style={{
                              marginRight: 4,
                              background: 'rgba(0,0,0,0.5)',
                              border: '1px solid rgba(248,113,113,0.5)',
                              color: '#f87171',
                              width: 16, height: 16,
                              borderRadius: '50%',
                              fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', padding: 0, lineHeight: 1,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              verticalAlign: 'middle',
                            }}
                          >−</button>
                        )}
                      </div>
                    </>
                  ) : (
                    netProfit(p.id) !== 0 && (
                      <div style={{
                        marginTop: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: netProfit(p.id) > 0 ? '#4ade80' : '#f87171',
                        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                      }}>
                        {netProfit(p.id) >= 0 ? '+' : ''}₪{netProfit(p.id).toLocaleString()}
                      </div>
                    )
                  )}

                  {/* Leave seat button (only when not in live game) */}
                  {canEdit && canManagePlayer(p) && !isLive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); leaveSeat(p) }}
                      title="לקום מהמושב"
                      style={{
                        position: 'absolute',
                        top: -6, right: -6,
                        background: 'rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#f87171',
                        width: 18, height: 18,
                        borderRadius: '50%',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >×</button>
                  )}
                  {isLive && ls && (
                    <div style={{
                      position: 'absolute',
                      top: -4, right: -4,
                      background: '#dc2626',
                      borderRadius: '50%',
                      width: 12, height: 12,
                      border: '2px solid #0e5530',
                      animation: 'pulse 1.5s infinite',
                    }} />
                  )}
                </>
              ) : (
                /* Empty seat: + button */
                canEdit ? (
                  <button
                    onClick={() => openClaimSeat(seatNum)}
                    style={{
                      width: 50, height: 50,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.2), rgba(0,0,0,0.3))',
                      border: '2px dashed rgba(212,175,55,0.45)',
                      color: 'rgba(212,175,55,0.8)',
                      fontSize: 22,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      padding: 0,
                      margin: '0 auto',
                      display: 'block',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.35), rgba(0,0,0,0.4))'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.2), rgba(0,0,0,0.3))'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >+</button>
                ) : (
                  <div style={{
                    width: 50, height: 50,
                    borderRadius: '50%',
                    border: '2px dashed rgba(255,255,255,0.15)',
                    margin: '0 auto',
                  }} />
                )
              )}
              {/* Seat number */}
              <div style={{
                marginTop: p ? 0 : 4,
                fontSize: 9,
                color: 'rgba(240,230,211,0.35)',
                fontWeight: 600,
              }}>
                מושב {seatNum}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unseated players */}
      {unseatedPlayers.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
            שחקנים ללא מושב ({unseatedPlayers.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unseatedPlayers.map(p => (
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

      {/* Prominent Start Game CTA after players are seated */}
      {!isLive && Object.keys(seatedPlayers).length > 0 && canEdit && (
        <div className="card" style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(153,27,27,0.10))',
          border: '1px solid rgba(220,38,38,0.45)',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            {Object.keys(seatedPlayers).length} {Object.keys(seatedPlayers).length === 1 ? 'שחקן יושב' : 'שחקנים יושבים'} בשולחן · קנייה ₪{buyInAmount} = {chipsPerBuyin} ג'יטונים
          </div>
          <button
            onClick={() => startGameWithBuyIn(null)}
            className="btn btn-red btn-block"
            style={{ fontSize: 17, padding: '14px 24px', letterSpacing: 1 }}
          >
            ▶ התחל משחק
          </button>
        </div>
      )}

      {/* Hint during live game (the End Session button is on the table itself) */}
      {isLive && canEdit && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          💡 לחץ "+" על שחקן להוספת קנייה · 🏁 הכפתור הירוק במרכז השולחן לסיום
        </div>
      )}

      {/* History + Last summary buttons (when there's any history) */}
      {sessions.filter(s => !s.is_live).length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowHistory(true)}
            className="btn btn-ghost"
            style={{ fontSize: 13, padding: '8px 16px', border: '1px solid rgba(212,175,55,0.4)', color: '#fbbf24' }}
          >
            📜 היסטוריית משחקים
          </button>
          {!isLive && (
            <button
              onClick={() => setShowLastSummary(true)}
              className="btn btn-gold"
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              📊 סיכום אחרון
            </button>
          )}
        </div>
      )}

      {/* Quick info */}
      {!isLive && Object.keys(seatedPlayers).length === 0 && (
        <div className="card" style={{ textAlign: 'center', fontSize: 13 }}>
          <div style={{ color: 'var(--text-muted)' }}>
            🪑 לחץ על "+" במושב כדי להצטרף לשולחן
          </div>
        </div>
      )}

      {/* Claim seat modal */}
      {showClaimModal && (
        <div className="modal-overlay" onClick={() => !working && setShowClaimModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 16 }}>
              הצטרף למושב {showClaimModal.seat}
            </h2>

            {/* Mode toggle */}
            {unseatedPlayers.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <button
                  className={`tab ${claimMode === 'existing' ? 'active' : ''}`}
                  onClick={() => setClaimMode('existing')}
                  style={{ flex: 1 }}
                >
                  שחקן קיים
                </button>
                <button
                  className={`tab ${claimMode === 'new' ? 'active' : ''}`}
                  onClick={() => setClaimMode('new')}
                  style={{ flex: 1 }}
                >
                  + שחקן חדש
                </button>
              </div>
            )}

            {claimMode === 'existing' && unseatedPlayers.length > 0 ? (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>בחר את עצמך</label>
                <select value={selectedExisting} onChange={e => setSelectedExisting(e.target.value)}>
                  {unseatedPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.user_id === user?.id ? ' ★ אתה' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>שמך</label>
                <input
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  placeholder="שם השחקן"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && claimSeat()}
                />
                {!myPlayer && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    שחקן זה יקושר לחשבון Google שלך - רק אתה תוכל להוסיף לו קניות במשחקים חיים.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-red"
                style={{ flex: 1 }}
                onClick={claimSeat}
                disabled={working || (claimMode === 'new' ? !newPlayerName.trim() : !selectedExisting)}
              >
                {working ? 'שומר...' : '🪑 שב'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowClaimModal(null)} disabled={working}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* End game modal */}
      {showEndGame && (
        <EndGameModal
          table={table}
          players={players}
          liveSessions={liveSessions}
          onClose={() => setShowEndGame(false)}
        />
      )}

      {/* Last game summary */}
      {showLastSummary && (
        <LastGameSummary
          table={table}
          players={players}
          sessions={sessions}
          onClose={() => setShowLastSummary(false)}
        />
      )}

      {/* Full game history */}
      {showHistory && (
        <GameHistoryModal
          table={table}
          players={players}
          sessions={sessions}
          onClose={() => setShowHistory(false)}
          onPlayerClick={onPlayerClick}
        />
      )}
    </div>
  )
}

// Inline component: shows the most recent game's summary (read-only)
function LastGameSummary({ table, players, sessions, onClose }) {
  // Find the most recent date among non-live sessions
  const dates = [...new Set(sessions.filter(s => !s.is_live).map(s => s.date))].sort().reverse()
  const lastDate = dates[0]
  if (!lastDate) return null

  const dayItems = sessions
    .filter(s => s.date === lastDate && !s.is_live)
    .map(s => ({ session: s, player: players.find(p => p.id === s.player_id) }))
    .filter(x => x.player)
    .sort((a, b) => Number(b.session.profit || 0) - Number(a.session.profit || 0))

  const totalBuyIns = dayItems.reduce((a, x) => a + Number(x.session.buy_in || 0), 0)
  const totalProfit = dayItems.reduce((a, x) => a + Number(x.session.profit || 0), 0)
  const winners = dayItems.filter(x => Number(x.session.profit || 0) > 0)
  const losers = dayItems.filter(x => Number(x.session.profit || 0) < 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 6, textAlign: 'center' }}>
          📊 סיכום משחק אחרון
        </h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
          {new Date(lastDate).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>קופה</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>₪{totalBuyIns.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>שחקנים</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{dayItems.length}</div>
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

        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>דירוג</div>
        <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
          {dayItems.map((x, i) => {
            const profit = Number(x.session.profit || 0)
            return (
              <div key={x.session.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 10, marginBottom: 6,
                background: i === 0
                  ? 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,134,11,0.08))'
                  : 'var(--bg3)',
                borderRadius: 10,
                border: i === 0 ? '1px solid rgba(212,175,55,0.5)' : '1px solid var(--border)',
                borderRight: `3px solid ${x.player.color}`,
              }}>
                <div style={{ fontSize: 18, width: 26, textAlign: 'center' }}>
                  {['🥇','🥈','🥉'][i] || `${i+1}.`}
                </div>
                <div className="avatar" style={{ background: x.player.color, width: 34, height: 34, fontSize: 13 }}>
                  {x.player.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{x.player.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    קנייה ₪{x.session.buy_in} · יציאה ₪{x.session.cash_out}
                    {x.session.final_chips > 0 && ` · ${x.session.final_chips} ג'יטונים`}
                  </div>
                </div>
                <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {profit >= 0 ? '+' : ''}₪{Math.round(profit).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>

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
            {losers.map(l => `${l.player.name} משלם ₪${Math.abs(Math.round(Number(l.session.profit)))}`).join(' · ')}
          </div>
        )}

        <button className="btn btn-red btn-block" onClick={onClose}>סגור</button>
      </div>
    </div>
  )
}
