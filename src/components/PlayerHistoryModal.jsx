import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler)

export default function PlayerHistoryModal({ player, sessions, onClose }) {
  const playerSessions = useMemo(
    () => sessions.filter(s => s.player_id === player.id && !s.is_live).sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, player.id]
  )

  const stats = useMemo(() => {
    const total = playerSessions.reduce((a, s) => a + Number(s.profit || 0), 0)
    const wins = playerSessions.filter(s => Number(s.profit || 0) > 0).length
    const losses = playerSessions.filter(s => Number(s.profit || 0) < 0).length
    const ties = playerSessions.filter(s => Number(s.profit || 0) === 0).length
    const avg = playerSessions.length > 0 ? total / playerSessions.length : 0
    const best = playerSessions.reduce((b, s) => Number(s.profit || 0) > Number(b?.profit ?? -Infinity) ? s : b, null)
    const worst = playerSessions.reduce((w, s) => Number(s.profit || 0) < Number(w?.profit ?? Infinity) ? s : w, null)
    const hours = playerSessions.reduce((a, s) => a + Number(s.hours || 0), 0)
    return { total, wins, losses, ties, avg, best, worst, hours, count: playerSessions.length }
  }, [playerSessions])

  const chartData = useMemo(() => {
    let cum = 0
    const labels = []
    const data = []
    for (const s of playerSessions) {
      cum += Number(s.profit || 0)
      labels.push(new Date(s.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }))
      data.push(cum)
    }
    return {
      labels,
      datasets: [{
        label: 'רווח מצטבר (₪)',
        data,
        borderColor: player.color,
        backgroundColor: player.color + '33',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    }
  }, [playerSessions, player.color])

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937', titleColor: '#f0e6d3', bodyColor: '#fff',
        callbacks: { label: ctx => ` ₪${ctx.raw.toLocaleString()}` }
      }
    },
    scales: {
      x: { ticks: { color: 'rgba(240,230,211,0.5)', font: { family: 'Heebo', size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: 'rgba(240,230,211,0.5)', font: { family: 'Heebo', size: 10 }, callback: v => `₪${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div className="avatar" style={{ background: player.color, width: 56, height: 56, fontSize: 22 }}>
            {player.name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'Playfair Display', margin: 0, fontSize: 24 }}>{player.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {stats.count} משחקים · {stats.hours}ש'
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={onClose}>✕</button>
        </div>

        {/* Big total */}
        <div style={{ textAlign: 'center', padding: '14px 0', marginBottom: 14, background: 'var(--bg3)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>רווח/הפסד כולל</div>
          <div className={stats.total > 0 ? 'profit-pos' : stats.total < 0 ? 'profit-neg' : ''}
            style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Playfair Display' }}>
            {stats.total >= 0 ? '+' : ''}₪{stats.total.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            ממוצע למשחק: ₪{Math.round(stats.avg).toLocaleString()}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>נצחונות</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{stats.wins}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>תיקו</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>{stats.ties}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>הפסדים</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{stats.losses}</div>
          </div>
        </div>

        {/* Best/Worst */}
        {stats.best && stats.worst && stats.best !== stats.worst && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>המשחק הטוב ביותר</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>+₪{Number(stats.best.profit).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(stats.best.date).toLocaleDateString('he-IL')}</div>
            </div>
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>המשחק הגרוע ביותר</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>₪{Number(stats.worst.profit).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(stats.worst.date).toLocaleDateString('he-IL')}</div>
            </div>
          </div>
        )}

        {/* Chart */}
        {playerSessions.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>רווח מצטבר לאורך זמן</div>
            <div style={{ height: 180, background: 'var(--bg3)', borderRadius: 10, padding: 10 }}>
              <Line data={chartData} options={chartOpts} />
            </div>
          </div>
        )}

        {/* Sessions list */}
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>משחקים אחרונים</div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {playerSessions.slice().reverse().map(s => {
            const profit = Number(s.profit || 0)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(s.date).toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    קנייה ₪{Number(s.buy_in || 0)} · יציאה ₪{Number(s.cash_out || 0)}
                    {s.hours > 0 && ` · ${s.hours}ש'`}
                  </div>
                </div>
                <span className={`badge ${profit > 0 ? 'badge-green' : profit < 0 ? 'badge-red' : 'badge-gold'}`}>
                  {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                </span>
              </div>
            )
          })}
          {playerSessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>אין עדיין היסטוריית משחקים</div>
          )}
        </div>
      </div>
    </div>
  )
}
