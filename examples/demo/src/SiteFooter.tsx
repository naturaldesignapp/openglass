import { NaturalDesignWordmark } from './NaturalDesignLogo'

const GITHUB_URL = 'https://github.com/naturaldesignapp/openglass'

export function SiteFooter() {
  return (
    <footer
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '26px var(--nd-gutter)',
        borderTop: '1px solid var(--nd-rule)',
        color: 'var(--nd-muted)',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--nd-brand)' }}>
        <NaturalDesignWordmark style={{ display: 'block', width: 78, height: 'auto' }} aria-hidden />
        <span aria-hidden style={{ width: 1, height: 16, background: 'var(--nd-hair)' }} />
        <span style={{ color: 'var(--nd-muted)' }}>OpenGlass - By Natural Design</span>
      </div>
      <nav aria-label="Footer" style={{ display: 'flex', gap: 18 }}>
        <a className="nd-link" style={{ color: 'var(--nd-muted)' }} href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
        <a className="nd-link" style={{ color: 'var(--nd-muted)' }} href="https://www.naturaldesign.app/homepage" target="_blank" rel="noreferrer">Natural Design</a>
        <span>MIT</span>
      </nav>
    </footer>
  )
}
