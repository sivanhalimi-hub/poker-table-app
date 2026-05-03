import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SessionsTab({ tableId, players, sessions, isOwner, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editSession, setEditSession] = useState(null)
  const [form, setForm] = useState({ player_id: '', date: today(), buy_in: '', cash_out: '', hours: '', notes: '' })
  const [saving, setSaving] = useState(false)

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

  function playerName(pid) { return players.find(p => p.id === pid)?.name || '?' }
  function playerColor(pid) { return players.find(p => p.id === pid)?.color || '#888' }

  return (
    <div>
      {isOwner && (
        <button className="btn btn-red btn-block" style={{ marginBottom: 14 }} onClick={openNew}>
          + הוסף סשן
        </button>
      )}

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          אין סשנים עדיין
        </div>
      ) : sessions.map(s => {
        const profit = s.profit ?? (s.cash_out - s.buy_in)
        const pColor = playerColor(s.player_id)
        return (
          <div key={s.id} className="card" style={{ borderRight: `3px solid ${pColor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            {isOwner && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => openEdit(s)}>✎ עריכה</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: '#f87171' }} onClick={() => deleteSession(s.id)}>✕ מחק</button>
              </div>
            )}
          </div>
        )
      })}

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
