export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Prompt Creator API</h1>
      <p>TomikOS AI Prompt Creator - API Only</p>
      <hr style={{ margin: '1rem 0' }} />
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/prompt-creator/chat</code> - Send messages (streaming)</li>
        <li><code>GET /api/prompt-creator/sessions</code> - List sessions</li>
        <li><code>POST /api/prompt-creator/sessions</code> - Create session, get messages, save prompt</li>
        <li><code>DELETE /api/prompt-creator/sessions?session_id=xxx</code> - Delete session</li>
      </ul>
    </main>
  )
}

