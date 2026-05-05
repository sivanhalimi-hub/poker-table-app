import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function JoinByCode() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '')
    supabase.from('tables').select('id, code').eq('code', normalized).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('הקוד לא נמצא.')
          setTimeout(() => navigate('/'), 2500)
          return
        }
        navigate(`/table/${data.id}`, { replace: true })
      })
  }, [code, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
      {error ? (
        <>
          <div style={{ fontSize: 40 }}>🔍</div>
          <div>{error}</div>
          <div style={{ fontSize: 12 }}>חוזר לדף הבית...</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 28 }}>♠</div>
          <div>נכנס לשולחן {code}...</div>
        </>
      )}
    </div>
  )
}
