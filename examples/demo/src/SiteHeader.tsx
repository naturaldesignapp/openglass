import { CopyInstall } from './CopyInstall'
import { NaturalDesignWordmark } from './NaturalDesignLogo'

const GITHUB_URL = 'https://github.com/naturaldesignapp/openglass'

/** Natural Design marketing header, locked up with the OpenGlass package name. */
export function SiteHeader() {
  return (
    <header className="nd-header">
      <a href="#top" aria-label="OpenGlass, a Natural Design package" className="nd-brand">
        <NaturalDesignWordmark style={{ width: 88, height: 'auto' }} aria-hidden />
        <span aria-hidden style={{ width: 1, height: 18, background: 'var(--nd-hair)' }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--nd-ink)', letterSpacing: '-0.01em' }}>OpenGlass</span>
      </a>

      <nav aria-label="Sections" style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
        <a className="nd-pill" href="#try">Try it</a>
        <a className="nd-pill" href="#story">Story</a>
        <a className="nd-pill" href="#material">Material</a>
      </nav>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        <a className="nd-pill" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
        <CopyInstall variant="solid" />
      </div>
    </header>
  )
}
