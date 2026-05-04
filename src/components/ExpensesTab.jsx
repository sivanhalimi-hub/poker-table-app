import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ExpensesTab({ tableId, players, expenses, canEdit, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', paid_by: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({
      table_id: tableId,
      description: form.description.trim(),
      amount: Number(form.amount),
      paid_by: form.paid_by || null,
      date: new Date().toISOString().split('T')[0]
    })
    setSaving(false)
    setShowForm(false)
    setForm({ description: '', amount: '', paid_by: '' })
    onRefresh()
  }

  async function deleteExpense(id) {
    if (!confirm('למחוק הוצאה זו?')) return
    await supabase.from('expenses').delete().eq('id', id)
    onRefresh()
  }

  const total = expenses.reduce((a, e) => a + e.amount, 0)
  const perPlayer = players.length > 0 ? total / players.length : 0

  function playerName(pid) { return players.find(p => p.id === pid)?.name || '' }

  return (
    <div>
      {canEdit && (
        <button className="btn btn-gold btn-block" style={{ marginBottom: 14 }} onClick={() => setShowForm(true)}>
          + הוצאה חדשה
        </button>
      )}

      {total > 0 && (
        <div className="card" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>סה"כ הוצאות</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24' }}>₪{total.toLocaleString()}</div>
            </div>
            {players.length > 0 && (
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>לכל שחקן</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24' }}>₪{Math.round(perPlayer).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          אין הוצאות
        </div>
      ) : expenses.map(e => (
        <div key={e.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{e.description}</div>
            {e.paid_by && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>שילם: {playerName(e.paid_by)}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(e.date).toLocaleDateString('he-IL')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-gold">₪{e.amount.toLocaleString()}</span>
            {canEdit && (
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: '#f87171' }} onClick={() => deleteExpense(e.id)}>✕</button>
            )}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', marginBottom: 20 }}>הוצאה חדשה</h2>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>תיאור</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="למשל: אוכל, שתייה..." autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>סכום (₪)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>שילם (אופציונלי)</label>
              <select value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}>
                <option value="">לא צוין</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={save} disabled={saving}>
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
