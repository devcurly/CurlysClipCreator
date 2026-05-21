import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_SIZE = 2 * 1024 * 1024 * 1024

function fmtSize(b) {
  if (b < 1048576) return (b / 1024).toFixed(1) + ' kb'
  return (b / 1048576).toFixed(1) + ' mb'
}

function fmtDur(s) {
  if (!s || s === 0) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + 'm ' + sec + 's'
}

export default function App() {
  const [file, setFile] = useState(null)
  const [fileMeta, setFileMeta] = useState('')
  const [busy, setBusy] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [splitting, setSplitting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [outputDir, setOutputDir] = useState('')
  const [dragging, setDragging] = useState(false)
  const [dotClass, setDotClass] = useState('')
  const [statusText, setStatusText] = useState('waiting for video')
  const inputRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [])

  const setStatus = useCallback((txt, cls) => {
    setStatusText(txt)
    setDotClass(cls || '')
  }, [])

  const connectWs = useCallback((id) => {
    if (wsRef.current) wsRef.current.close()
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/${id}`)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
      } else if (data.type === 'complete') {
        setSplitting(false)
        setResults(data.results)
        setStatus('done', 'ok')
      } else if (data.type === 'error') {
        setSplitting(false)
        setError(data.message || 'split failed')
        setStatus('failed', 'err')
      }
    }
    wsRef.current = ws
  }, [setStatus])

  const resetAll = useCallback(() => {
    if (jobId) fetch(`/api/clear/${jobId}`, { method: 'POST' }).catch(() => {})
    if (wsRef.current) wsRef.current.close()
    setFile(null)
    setFileMeta('')
    setAnalysis(null)
    setResults(null)
    setError(null)
    setJobId(null)
    setOutputDir('')
    setSplitting(false)
    setBusy(false)
    setStatus('waiting for video', '')
  }, [jobId, setStatus])

  const pickFile = useCallback(async (f) => {
    if (!f) return
    const vtype = f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name)
    if (!vtype) {
      setError('unsupported file type')
      setStatus('unsupported', 'err')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('file too large (max 2GB)')
      setStatus('too large', 'err')
      return
    }
    setFile(f)
    setError(null)

    let dur = ''
    try {
      const url = URL.createObjectURL(f)
      const v = document.createElement('video')
      v.src = url
      await new Promise((resolve) => { v.onloadedmetadata = resolve })
      dur = fmtDur(v.duration)
      URL.revokeObjectURL(url)
    } catch {}

    setFileMeta(fmtSize(f.size) + (dur ? ' \u00b7 ' + dur : ''))

    setBusy(true)
    setAnalysis(null)
    setResults(null)
    setStatus('analyzing...', 'run')

    try {
      const formData = new FormData()
      formData.append('file', f)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const text = await res.text()
        let msg
        try { msg = JSON.parse(text).detail } catch { msg = text || res.statusText }
        throw new Error(msg)
      }
      const d = await res.json()
      setAnalysis(d)
      setJobId(d.job_id)
      setOutputDir(d.output_dir)
      connectWs(d.job_id)
      setStatus(d.scene_count + ' scenes detected', 'ok')
    } catch (e) {
      setError(e.message || 'upload failed')
      setStatus('failed', 'err')
    } finally {
      setBusy(false)
    }
  }, [connectWs, setStatus])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [pickFile])

  const handleBrowse = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files[0]
    if (f) pickFile(f)
    e.target.value = ''
  }, [pickFile])

  const startSplit = useCallback(async () => {
    if (!jobId) return
    setSplitting(true)
    setError(null)
    setStatus('splitting clips...', 'run')

    try {
      const res = await fetch(`/api/split/${jobId}`, { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        let msg
        try { msg = JSON.parse(text).detail } catch { msg = text || res.statusText }
        throw new Error(msg)
      }
    } catch (e) {
      setError(e.message || 'split failed')
      setStatus('failed', 'err')
      setSplitting(false)
    }
  }, [jobId, setStatus])

  const hasFile = file || analysis || results

  return (
    <div className="panel" style={{
      position: 'relative', zIndex: 1, width: '100%', maxWidth: 520,
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border-lit)',
      borderRight: '1px solid var(--border-lit)',
      borderBottom: '1px solid var(--border-lit)',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 7, height: 7,
        borderBottom: '1px solid var(--accent)',
        borderRight: '1px solid var(--accent)',
        pointerEvents: 'none',
      }} />

      <div className="topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 13px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        borderTop: '2px solid var(--accent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 16, height: 16, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="8" height="8" viewBox="0 0 8 8" style={{ stroke: '#0e0e0d', fill: 'none', strokeWidth: 2, strokeLinecap: 'square' }}>
              <polyline points="1,7 4,1 7,7" />
            </svg>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            curly's clip creator
          </span>
        </div>
        <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em' }}>v1.0</span>
      </div>

      <div className="body" style={{ padding: '16px 14px 14px' }}>

        {!results && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
            onClick={handleBrowse}
            style={{
              border: '1px dashed ' + (dragging ? 'var(--accent)' : 'var(--border-lit)'),
              padding: '28px 16px 24px', textAlign: 'center', cursor: 'pointer',
              position: 'relative', userSelect: 'none',
              background: dragging ? 'rgba(204,61,240,0.06)' : 'transparent',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <div style={{
              position: 'absolute', inset: 3,
              border: '1px solid ' + (dragging ? 'rgba(204,61,240,0.1)' : 'transparent'),
              transition: 'border-color 0.12s', pointerEvents: 'none',
            }} />
            <input ref={inputRef} type="file" accept=".mp4,.mov,.avi,.mkv,.webm,.m4v" style={{ display: 'none' }} onChange={handleFileSelect} />
            <div style={{ width: 22, height: 22, margin: '0 auto 10px', opacity: hasFile ? 0.65 : 0.3 }}>
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', stroke: 'var(--text)', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'square' }}>
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              {file ? file.name : 'drop video or click to browse'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              mp4 &middot; mov &middot; webm &middot; mkv
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 8, padding: '6px 9px',
            border: '1px solid var(--danger)', color: 'var(--danger)',
            fontSize: 10, letterSpacing: '0.04em',
          }}>
            {error}
          </div>
        )}

        {file && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 10, padding: '7px 9px',
            border: '1px solid var(--border)', background: 'var(--bg)',
          }}>
            <span style={{ fontSize: 9, color: 'var(--dim)', flexShrink: 0 }}>//</span>
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', fontSize: 10, color: 'var(--text)',
            }}>{file.name}</span>
            <span style={{ fontSize: 9, color: 'var(--dim)', flexShrink: 0 }}>{fileMeta}</span>
            {!analysis && !results && !busy && (
              <button onClick={(e) => { e.stopPropagation(); resetAll() }}
                style={{
                  background: 'none', border: 'none', color: 'var(--dim)',
                  cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 1px',
                  fontFamily: 'var(--mono)', flexShrink: 0,
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--danger)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--dim)'}
              >&#x2715;</button>
            )}
          </div>
        )}

        {splitting && (
          <div style={{
            marginTop: 16, padding: '20px 14px',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 20, height: 20, margin: '0 auto 12px',
              border: '1.5px solid var(--accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>
              splitting clips
              <span style={{ animation: 'dotPulse 1.4s infinite', marginLeft: 2 }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s 0.2s infinite', marginLeft: 1 }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s 0.4s infinite', marginLeft: 1 }}>.</span>
            </div>
          </div>
        )}

        {analysis && !results && !splitting && (
          <div style={{
            marginTop: 10, padding: '7px 9px',
            border: '1px solid var(--border)', background: 'var(--bg)',
            maxHeight: 140, overflowY: 'auto',
          }}>
            {analysis.scenes.map((scene) => (
              <div key={scene.index} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0', fontSize: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--accent)', width: 24 }}>#{scene.index}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {fmtDur(scene.start)} &ndash; {fmtDur(scene.end)}
                </span>
                <span style={{ color: 'var(--dim)' }}>{fmtDur(scene.duration)}</span>
              </div>
            ))}
          </div>
        )}

        {results && !splitting && (
          <div style={{
            marginTop: 10, padding: '7px 9px',
            border: '1px solid var(--border)', background: 'var(--bg)',
            maxHeight: 200, overflowY: 'auto',
          }}>
            {results.map((scene) => (
              <div key={scene.index} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0', fontSize: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--accent)', width: 24 }}>#{scene.index}</span>
                <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 8px' }}>
                  {scene.filename}
                </span>
                <span style={{ color: 'var(--dim)' }}>{fmtSize(scene.size)}</span>
              </div>
            ))}
          </div>
        )}

        {results && !splitting && (
          <div style={{ marginTop: 8, fontSize: 9, color: 'var(--dim)', textAlign: 'center', letterSpacing: '0.04em' }}>
            saved to {outputDir}
          </div>
        )}

        <div className="actions" style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {!results && (
            <button onClick={startSplit} disabled={!analysis || splitting}
              style={{
                flex: 1, padding: '9px 12px',
                background: !analysis || splitting ? 'var(--dim)' : 'var(--accent)',
                color: !analysis || splitting ? 'var(--muted)' : '#0e0e0d',
                border: 'none',
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: !analysis || splitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.1s, transform 0.07s',
              }}
              onMouseEnter={(e) => { if (!analysis || splitting) return; e.target.style.background = 'var(--accent-dark)' }}
              onMouseLeave={(e) => { if (!analysis || splitting) return; e.target.style.background = 'var(--accent)' }}
            >
              {!analysis ? 'Process' : 'Split ' + analysis.scene_count + ' clips'}
            </button>
          )}
          {results && (
            <button onClick={resetAll}
              style={{
                flex: 1, padding: '9px 12px',
                background: 'var(--accent)', color: '#0e0e0d',
                border: 'none',
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--accent-dark)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--accent)'}
            >
              Split another
            </button>
          )}
          <button onClick={resetAll}
            style={{
              padding: '9px 10px', background: 'none',
              border: '1px solid var(--border-lit)', color: 'var(--muted)',
              fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer',
              letterSpacing: '0.04em', transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { e.target.style.borderColor = 'var(--danger)'; e.target.style.color = 'var(--danger)' }}
            onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border-lit)'; e.target.style.color = 'var(--muted)' }}
          >
            Reset
          </button>
        </div>

        <div className="status" style={{
          marginTop: 9, display: 'flex', alignItems: 'center', gap: 5, minHeight: 12,
        }}>
          <div className={'dot' + (dotClass ? ' ' + dotClass : '')} style={{
            width: 4, height: 4, flexShrink: 0,
            background: dotClass === 'ok' ? 'var(--accent)' : dotClass === 'err' ? 'var(--danger)' : dotClass === 'run' ? 'var(--accent)' : 'var(--dim)',
            animation: dotClass === 'run' ? 'blink 0.6s step-start infinite' : 'none',
            transition: 'background 0.2s',
          }} />
          <span style={{
            fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em',
          }}>{statusText}</span>
        </div>

      </div>

      <div className="footer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 13px', borderTop: '1px solid var(--border)',
        marginTop: '0px', background: 'var(--bg)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em' }}>
          made with ffmpeg
        </span>
        <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em' }}>
          curly
        </span>
      </div>
    </div>
  )
}
