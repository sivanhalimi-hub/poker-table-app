import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = ['#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#db2777','#0891b2','#65a30d','#f97316','#84cc16']

export default function PlayersTab({ tableId, players, sessions, canEdit, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editPlayer, setEditPlayer] = useState(null)
  const [form, setForm] = useState({ name: '', color: COLORS[0] })
  const [saving, setSaving] = useState(false)

  function openEdit(p) {
    setEditPlayer(p)
    setForm({ name: p.name, color: p.color })
    setShowForm(true)
  }

  function openNew() {
    setEditPlayer(null)
    const usedColors = players.map(p => p.color)
    const nextColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[players.length % COLORS.length]
    setForm({ name: '', color: nextColor })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editPlayer) {
      await supabase.from('players').update({ name: form.name.trim(), color: form.color }).eq('id', editPlayer.id)
    } else {
      await supabase.from('players').insert({ table_id: tableId, name: form.name.trim(), color: form.color })
    }
    setSaving(false)
    setShowForm(false)
    onRefresh()
  }

  async function deletePlayer(id) {
    if (!confirm('למחוק שחקן זה? כל הסשנים שלו יימחקו.')) return
    await supabase.from('players').delete().eq('id', id)
    onRefresh()
  }

  function playerStats(pid) {
    const ps = sessions.filter(s => s.player_id === pid)
    const profit = ps.reduce((a, s) => a + (s.profit || 0), 0)
    const hours = ps.reduce((a, s) => a + (s.hours || 0), 0)
    return { games: ps.length, profit, hours }
  }

  return (
    <div>
      {canEdit && (
        <button className="btn btn-red btn-block" style={{ marginBottom: 14 }} onClick={openNew}>
          + הוסף שחקן
        </button>
      )}

      {players.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          אין שחקנים עדיין
        </div>
      ) : players.map(p => {
        const st = playerStats(p.id)
        return (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="avatar" style={{ background: p.color, width: 44, height: 44, fontSize: 18 }}>
              {p.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {st.games} משחקים · {st.hours}ש'
              </div>
            </div>
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span className={`badge ${st.profit > 0 ? 'badge-green' : st.profit < 0 ? 'badge-red' : 'badge-gold'}`}>
                {st.profit > 0 ? '+' : ''}₪{st.profit.toLocaleString()}
              </span>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(p)}>✎</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: '#f87171' }} onClick={() => deletePlayer(p.id)}>✕</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 20 }}>
              {editPlayer ? 'עריכת שחקן' : 'שחקן חדש'}
            </h2>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>שם</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="שם השחקן" autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>צבע בגרף</label>
              <div className="color-picker-row">
                {COLORS.map(c => (
                  <div key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                    style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                ))}
              </div>
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
