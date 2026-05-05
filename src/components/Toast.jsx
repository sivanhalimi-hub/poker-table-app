import { useEffect, useState } from 'react'

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
      width: '90%',
      maxWidth: 400,
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setShow(true))
    const t = setTimeout(() => {
      setShow(false)
      setTimeout(onRemove, 300)
    }, toast.duration || 4000)
    return () => clearTimeout(t)
  }, [])

  const colors = {
    rebuy: { bg: 'linear-gradient(135deg, rgba(212,175,55,0.95), rgba(184,134,11,0.95))', icon: '🪙', border: 'rgba(212,175,55,0.6)' },
    info: { bg: 'rgba(30,41,59,0.95)', icon: 'ℹ️', border: 'rgba(255,255,255,0.15)' },
    success: { bg: 'linear-gradient(135deg, rgba(22,163,74,0.95), rgba(21,128,61,0.95))', icon: '✓', border: 'rgba(34,197,94,0.5)' },
    end: { bg: 'linear-gradient(135deg, rgba(220,38,38,0.95), rgba(153,27,27,0.95))', icon: '🏁', border: 'rgba(220,38,38,0.5)' },
    start: { bg: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(21,128,61,0.95))', icon: '▶', border: 'rgba(34,197,94,0.5)' },
  }
  const c = colors[toast.type] || colors.info

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: '10px 14px',
      color: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      fontWeight: 600,
      transform: show ? 'translateY(0)' : 'translateY(20px)',
      opacity: show ? 1 : 0,
      transition: 'transform 0.3s, opacity 0.3s',
      pointerEvents: 'auto',
      cursor: 'pointer',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    }}
    onClick={() => { setShow(false); setTimeout(onRemove, 300) }}>
      <span style={{ fontSize: 20 }}>{c.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  )
}
