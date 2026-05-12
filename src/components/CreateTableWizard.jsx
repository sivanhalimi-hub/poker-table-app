import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = ['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#65a30d','#f97316','#84cc16','#facc15','#a855f7']

export default function CreateTableWizard({ user, onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [tableName, setTableName] = useState('')
  const [buyInAmount, setBuyInAmount] = useState(50)
  const [chipsPerBuyin, setChipsPerBuyin] = useState(200)
  const [newPlayers, setNewPlayers] = useState([]) // [{ name, color, initialBuyIn }]
  const [playerName, setPlayerName] = useState('')
  const [playerBuyIn, setPlayerBuyIn] = useState('')
  const [creating, setCreating] = useState(false)

  const chipValue = Number(chipsPerBuyin) > 0 ? Number(buyInAmount) / Number(chipsPerBuyin) : 0

  function addPlayer() {
    const name = playerName.trim()
    if (!name) return
    if (newPlayers.some(p => p.name === name)) {
      alert('שם השחקן כבר קיים')
      return
    }
    const usedColors = newPlayers.map(p => p.color)
    const color = COLORS.find(c => !usedColors.includes(c)) || COLORS[newPlayers.length % COLORS.length]
    const initial = playerBuyIn === '' ? Number(buyInAmount) : Number(playerBuyIn)
    setNewPlayers(p => [...p, { name, color, initialBuyIn: initial }])
    setPlayerName('')
    setPlayerBuyIn('')
  }

  function removePlayer(idx) {
    setNewPlayers(p => p.filter((_, i) => i !== idx))
  }

  function updatePlayerBuyIn(idx, value) {
    setNewPlayers(p => p.map((x, i) => i === idx ? { ...x, initialBuyIn: Number(value) || 0 } : x))
  }

  function updatePlayerColor(idx, color) {
    setNewPlayers(p => p.map((x, i) => i === idx ? { ...x, color } : x))
  }

  async function createAll() {
    if (!tableName.trim()) { setStep(1); return }
    setCreating(true)
    try {
      // 1) Create table
      const { data: table, error: tErr } = await supabase
        .from('tables')
        .insert({
          name: tableName.trim(),
          owner_id: user.id,
          buy_in_amount: Number(buyInAmount),
          chips_per_buyin: Number(chipsPerBuyin),
        })
        .select()
        .single()
      if (tErr) throw tErr

      // 2) Create players (assign seats 1..N)
      if (newPlayers.length > 0) {
        const rows = newPlayers.map((p, i) => ({
          table_id: table.id,
          name: p.name,
          color: p.color,
          seat: i < 9 ? i + 1 : null,
        }))
        const { data: insertedPlayers, error: pErr } = await supabase
          .from('players')
          .insert(rows)
          .select()
        if (pErr) throw pErr

        // 3) If any player has a different initial buy-in than default, do NOT create a session
        // Sessions are created when a live game starts. The chip settings on the table govern.
      }

      onCreated(table)
    } catch (e) {
      alert('שגיאה ביצירת השולחן: ' + (e.message || e))
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !creating && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        {/* Header / progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'Playfair Display', margin: 0, fontSize: 22 }}>
            {step === 1 ? 'שולחן חדש' : 'הוסף שחקנים'}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>שלב {step}/2</div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 3, background: '#dc2626', borderRadius: 2 }} />
          <div style={{ flex: 1, height: 3, background: step >= 2 ? '#dc2626' : 'var(--border)', borderRadius: 2 }} />
        </div>

        {step === 1 && (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>שם השולחן</label>
              <input
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                placeholder='למשל: "פוקר המשוט"'
                autoFocus
                onKeyDown={e => e.key === 'Enter' && tableName.trim() && setStep(2)}
              />
            </div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>קנייה (₪)</label>
                <input
                  type="number"
                  value={buyInAmount}
                  onChange={e => setBuyInAmount(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="form-group">
                <label>ג'יטונים לקנייה</label>
                <input
                  type="number"
                  value={chipsPerBuyin}
                  onChange={e => setChipsPerBuyin(e.target.value)}
                  placeholder="200"
                />
              </div>
            </div>
            <div style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 16,
              fontSize: 12,
              color: 'rgba(240,230,211,0.7)',
              textAlign: 'center',
            }}>
              💡 ערך ג'יטון: <span style={{ color: '#fbbf24', fontWeight: 700 }}>₪{chipValue.toFixed(2)}</span>
              <br/>
              <span style={{ fontSize: 11, opacity: 0.8 }}>בכל משחק חי, כל שחקן מתחיל עם קנייה אחת ויכול להוסיף עוד</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-red"
                style={{ flex: 1 }}
                onClick={() => setStep(2)}
                disabled={!tableName.trim() || !buyInAmount || !chipsPerBuyin}
              >
                הבא →
              </button>
              <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              הוסף את שחקני השולחן (אפשר תמיד להוסיף עוד מאוחר יותר):
            </div>

            {/* Add new player input */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="שם שחקן"
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-gold"
                onClick={addPlayer}
                disabled={!playerName.trim()}
                style={{ padding: '0 16px' }}
              >
                + הוסף
              </button>
            </div>

            {/* Player list */}
            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
              {newPlayers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>
                  אין שחקנים עדיין. הקלד שם ולחץ "+ הוסף"
                </div>
              ) : newPlayers.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg3)', borderRadius: 10, padding: 10, marginBottom: 8,
                  borderRight: `3px solid ${p.color}`,
                }}>
                  <div style={{ position: 'relative' }}>
                    <div className="avatar" style={{ background: p.color, width: 32, height: 32, fontSize: 13 }}>
                      {p.name[0]}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {COLORS.slice(0, 6).map(c => (
                        <div
                          key={c}
                          onClick={() => updatePlayerColor(i, c)}
                          style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: c, cursor: 'pointer',
                            border: p.color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => removePlayer(i)}
                    style={{ padding: '4px 8px', fontSize: 12, color: '#f87171' }}
                  >✕</button>
                </div>
              ))}
            </div>

            {newPlayers.length >= 9 && (
              <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center', marginBottom: 10 }}>
                ⚠ {newPlayers.length} שחקנים - 9 הראשונים יישבו במושבים
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={creating}>
                ← חזור
              </button>
              <button
                className="btn btn-red"
                style={{ flex: 1 }}
                onClick={createAll}
                disabled={creating}
              >
                {creating ? 'יוצר...' : `🃏 צור שולחן ${newPlayers.length > 0 ? `(${newPlayers.length} שחקנים)` : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
