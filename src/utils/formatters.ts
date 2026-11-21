export function formatINR(val: number | null | undefined, compact: boolean = false): string {
  if (val === null || val === undefined || isNaN(val)) return '₹0';

  if (compact) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${sign}₹${(abs / 1000).toFixed(1)} K`;
    }
  }

  // Format with Indian numbering system (e.g. 12,34,567.89)
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const fixed = absVal.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formattedInt}.${decPart}`;
}

export function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || isNaN(pct)) return '0.00%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function getAlertBadgeStyle(tag: string): { bg: string; text: string; border: string; glow: string } {
  if (tag.includes('BUY')) {
    return {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      glow: 'shadow-glow-rose'
    };
  }
  if (tag.includes('FALLING') || tag.includes('WATCH')) {
    return {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      glow: 'shadow-glow-gold'
    };
  }
  if (tag.includes('VERY STRONG') || tag.includes('STRONG')) {
    return {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      glow: 'shadow-glow-emerald'
    };
  }
  return {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    glow: 'shadow-glow-cyan'
  };
}
