import { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: 'rgba(240,230,211,0.7)', font: { family: 'Heebo', size: 12 } } },
    tooltip: {
      backgroundColor: '#1f2937',
      titleColor: '#f0e6d3',
      bodyColor: 'rgba(240,230,211,0.7)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      callbacks: { label: ctx => ` ₪${ctx.raw.toLocaleString()}` }
    }
  },
  scales: {
    x: { ticks: { color: 'rgba(240,230,211,0.5)', font: { family: 'Heebo' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: 'rgba(240,230,211,0.5)', font: { family: 'Heebo' }, callback: v => `₪${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
  }
}

export default function StatsTab({ players, sessions: allSessions, onPlayerClick }) {
  const [chartType, setChartType] = useState('bar')
  const [metric, setMetric] = useState('profit')
  // Exclude live (in-progress) sessions from stats so they don't pollute totals
  const sessions = useMemo(() => allSessions.filter(s => !s.is_live), [allSessions])

  const playerStats = useMemo(() => {
    return players.map(p => {
      const ps = sessions.filter(s => s.player_id === p.id)
      const profit = ps.reduce((a, s) => a + (s.profit || 0), 0)
      const hours = ps.reduce((a, s) => a + (s.hours || 0), 0)
      const games = ps.length
      const avgProfit = games > 0 ? profit / games : 0
      const perHour = hours > 0 ? profit / hours : 0
      return { ...p, profit, hours, games, avgProfit, perHour, sessions: ps }
    })
  }, [players, sessions])

  // Total profit over time (line chart)
  const profitOverTime = useMemo(() => {
    const allDates = [...new Set(sessions.map(s => s.date))].sort()
    const datasets = players.map(p => {
      let cumulative = 0
      const data = allDates.map(d => {
        const daySessions = sessions.filter(s => s.player_id === p.id && s.date === d)
        cumulative += daySessions.reduce((a, s) => a + (s.profit || 0), 0)
        return cumulative
      })
      return {
        label: p.name,
        data,
        borderColor: p.color,
        backgroundColor: p.color + '22',
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    })
    return { labels: allDates.map(d => new Date(d).toLocaleDateString('he-IL')), datasets }
  }, [players, sessions])

  // Bar chart data
  const barData = useMemo(() => {
    const metricMap = {
      profit: { key: 'profit', label: 'רווח/הפסד (₪)' },
      avgProfit: { key: 'avgProfit', label: 'ממוצע לסשן (₪)' },
      perHour: { key: 'perHour', label: 'ממוצע לשעה (₪)' },
      hours: { key: 'hours', label: 'שעות' },
    }
    return {
      labels: playerStats.map(p => p.name),
      datasets: [{
        label: metricMap[metric].label,
        data: playerStats.map(p => Math.round(p[metricMap[metric].key])),
        backgroundColor: playerStats.map(p => p.color + 'cc'),
        borderColor: playerStats.map(p => p.color),
        borderWidth: 2,
        borderRadius: 8,
      }]
    }
  }, [playerStats, metric])

  if (players.length === 0) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>אין שחקנים עדיין</div>
  }
  if (sessions.length === 0) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>אין סשנים עדיין</div>
  }

  return (
    <div>
      {/* Leaderboard */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>🏆 טבלת מובילים</div>
        {[...playerStats].sort((a, b) => b.profit - a.profit).map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, cursor: onPlayerClick ? 'pointer' : 'default' }}
            onClick={() => onPlayerClick?.(p)}>
            <div style={{ fontSize: 18, width: 28, textAlign: 'center', opacity: i < 3 ? 1 : 0.4 }}>
              {['🥇','🥈','🥉'][i] || `${i+1}.`}
            </div>
            <div className="avatar" style={{ background: p.color }}>{p.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.games} משחקים · {p.hours}ש'</div>
            </div>
            <span className={`badge ${p.profit > 0 ? 'badge-green' : p.profit < 0 ? 'badge-red' : 'badge-gold'}`}>
              {p.profit >= 0 ? '+' : ''}₪{p.profit.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Chart type toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
        <button className={`btn ${chartType === 'bar' ? 'btn-red' : 'btn-ghost'}`} onClick={() => setChartType('bar')}>
          📊 עמודות
        </button>
        <button className={`btn ${chartType === 'line' ? 'btn-red' : 'btn-ghost'}`} onClick={() => setChartType('line')}>
          📈 קו / פרבולה
        </button>
      </div>

      {/* Bar metric selector */}
      {chartType === 'bar' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
          {[
            { k: 'profit', l: 'רווח כולל' },
            { k: 'avgProfit', l: 'ממוצע לסשן' },
            { k: 'perHour', l: 'ממוצע/שעה' },
            { k: 'hours', l: 'שעות' },
          ].map(m => (
            <button key={m.k} className={`tab ${metric === m.k ? 'active' : ''}`} onClick={() => setMetric(m.k)}>
              {m.l}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card">
        <div className="chart-container" style={{ height: 300 }}>
          {chartType === 'bar' ? (
            <Bar data={barData} options={CHART_OPTS} />
          ) : (
            <Line data={profitOverTime} options={{ ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, tooltip: { ...CHART_OPTS.plugins.tooltip } } }} />
          )}
        </div>
      </div>

      {/* Per-player details */}
      <div style={{ fontWeight: 700, marginBottom: 10, marginTop: 4 }}>פירוט לכל שחקן</div>
      {playerStats.map(p => (
        <div key={p.id} className="card" style={{ borderRight: `3px solid ${p.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: onPlayerClick ? 'pointer' : 'default' }}
            onClick={() => onPlayerClick?.(p)}>
            <div className="avatar" style={{ background: p.color }}>{p.name[0]}</div>
            <div style={{ fontWeight: 700 }}>{p.name}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {[
              { l: 'רווח כולל', v: `${p.profit >= 0 ? '+' : ''}₪${p.profit.toLocaleString()}`, cls: p.profit > 0 ? 'profit-pos' : p.profit < 0 ? 'profit-neg' : '' },
              { l: 'משחקים', v: p.games },
              { l: 'ממוצע לסשן', v: `₪${Math.round(p.avgProfit).toLocaleString()}` },
              { l: 'ממוצע לשעה', v: `₪${Math.round(p.perHour).toLocaleString()}` },
              { l: 'שעות', v: `${p.hours}ש'` },
            ].map(item => (
              <div key={item.l} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.l}</div>
                <div style={{ fontWeight: 700, marginTop: 2 }} className={item.cls || ''}>{item.v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
