import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="center">
      <div className="card auth-card">
        <h1 className="auth-title">🌿 Каталог растений</h1>
        <p className="auth-sub">Админка · вход по ссылке на почту</p>

        {sent ? (
          <div className="notice">
            Письмо со ссылкой для входа отправлено на <b>{email}</b>.
            <br />
            Открой его на этом же устройстве и перейди по ссылке.
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Отправляем…' : 'Получить ссылку'}
            </button>
            {err && <div className="error">{err}</div>}
          </form>
        )}
      </div>
    </div>
  )
}
