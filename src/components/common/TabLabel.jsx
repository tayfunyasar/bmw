import React from 'react';

// Sekme etiketi — "🎯 Önerilen Araçlar — 46 araç" gibi düzyazı yerine iki parçalı okuma:
// ad + sağda sayaç çipi. Sayaçlar tabular-nums ile dizildiği için sekmeler alt alta
// geldiğinde rakamlar hizalanır; havuzun büyüklüğü sekmeyi açmadan okunur.
// Bu dosya TEK kaynak: MainTabs ve FrozenTabLabel aynı bileşeni kullanır.

const CHIP_TONE = {
  neutral: { bg: 'rgba(15,23,42,0.06)', fg: '#475569' },
  accent:  { bg: 'rgba(22,119,255,0.12)', fg: '#1677ff' },
  muted:   { bg: 'rgba(15,23,42,0.04)', fg: '#94a3b8' },
};

// Sayaçlar için dar, tabular monospace — rakam genişlikleri sabit kalsın diye.
const NUMERIC_FONT = "'SF Mono', 'JetBrains Mono', ui-monospace, 'Menlo', monospace";

export const CountChip = ({ value, tone = 'neutral' }) => {
  const { bg, fg } = CHIP_TONE[tone] || CHIP_TONE.neutral;
  return (
    <span style={{
      fontFamily: NUMERIC_FONT,
      fontVariantNumeric: 'tabular-nums',
      fontSize: 11,
      lineHeight: '16px',
      fontWeight: 600,
      padding: '0 6px',
      borderRadius: 5,
      background: bg,
      color: fg,
      minWidth: 22,
      textAlign: 'center',
    }}>{value}</span>
  );
};

export const TabLabel = ({ icon, children, count, tone }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    {icon && <span aria-hidden="true">{icon}</span>}
    <span>{children}</span>
    {count != null && <CountChip value={count} tone={tone} />}
  </span>
);
