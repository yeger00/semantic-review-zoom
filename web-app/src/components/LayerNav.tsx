interface Tab {
  id: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { id: 'packages', label: 'Packages', icon: '📦' },
  { id: 'symbols', label: 'Symbols', icon: 'ƒ' },
  { id: 'diffs', label: 'Diffs', icon: '±' },
]

interface Props {
  activeTab: string
  onChange: (id: string) => void
}

export default function LayerNav({ activeTab, onChange }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#161b22',
        borderTop: '1px solid #30363d',
        display: 'flex',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="tablist"
      aria-label="Review layers"
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderTop: `2px solid ${active ? '#58a6ff' : 'transparent'}`,
              color: active ? '#e6edf3' : '#8b949e',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 0',
              cursor: 'pointer',
              minHeight: 56,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
