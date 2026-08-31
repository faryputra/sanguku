// Webhook Mayar -> whitelist email pembeli + buat akun + kirim email "atur password"
// Jalan sebagai Vercel Serverless Function di: https://app.sanguku.com/api/mayar-webhook
// Env vars (diatur di Vercel -> Settings -> Environment Variables):
//   SUPABASE_URL                 = https://stxahqcdmrzxopcqeyya.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    = (Supabase -> Settings -> API -> service_role secret) -- RAHASIA
//   SUPABASE_ANON_KEY            = (Supabase -> Settings -> API -> anon public)
//   MAYAR_WEBHOOK_SECRET         = (string acak buatanmu, mis. 32 karakter)
//   APP_LOGIN_URL                = https://app.sanguku.com/login

module.exports = async (req, res) => {
  // Mayar mengirim POST JSON
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  // 1) Verifikasi rahasia (dikirim lewat query di URL webhook: ...?key=RAHASIA)
  const secret = process.env.MAYAR_WEBHOOK_SECRET;
  const gotKey = (req.query && req.query.key) || '';
  if (secret && gotKey !== secret) { res.status(401).json({ error: 'unauthorized' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const event = body.event || '';
  const data = body.data || {};

  // Balas 200 untuk test webhook / event lain (biar tombol "Test" di Mayar sukses)
  if (event !== 'payment.received') { res.status(200).json({ ok: true, ignored: event || 'test' }); return; }

  const email = String(data.customerEmail || '').trim().toLowerCase();
  if (!email) { res.status(200).json({ ok: true, note: 'no customer email' }); return; }

  const SUPA = process.env.SUPABASE_URL;
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON = process.env.SUPABASE_ANON_KEY || SR;
  const REDIRECT = process.env.APP_LOGIN_URL || 'https://app.sanguku.com/login';
  if (!SUPA || !SR) { res.status(500).json({ error: 'server not configured' }); return; }

  const adminHeaders = { 'apikey': SR, 'Authorization': 'Bearer ' + SR, 'Content-Type': 'application/json' };

  // 2) Whitelist email (upsert ke tabel allowed_emails; abaikan kalau sudah ada)
  try {
    await fetch(SUPA + '/rest/v1/allowed_emails?on_conflict=email', {
      method: 'POST',
      headers: Object.assign({}, adminHeaders, { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ email })
    });
  } catch (e) { /* lanjut */ }

  // 3) Buat akun Auth (kalau sudah ada, Supabase balas error 422 -> abaikan)
  try {
    await fetch(SUPA + '/auth/v1/admin/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email: email, email_confirm: true })
    });
  } catch (e) { /* lanjut */ }

  // 4) Kirim email "atur password" (reuse alur Lupa Password -> form Buat Password Baru di /login)
  try {
    await fetch(SUPA + '/auth/v1/recover?redirect_to=' + encodeURIComponent(REDIRECT), {
      method: 'POST',
      headers: { 'apikey': ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
  } catch (e) { /* lanjut */ }

  res.status(200).json({ ok: true, email: email });
};
