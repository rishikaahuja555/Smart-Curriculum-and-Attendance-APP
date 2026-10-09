import React from 'react';
import { colors } from '../theme';

const toneStyles = {
  brand: { background: colors.brandSecondary, foreground: colors.onBrandSecondary },
  success: { background: '#DCEEDF', foreground: colors.success },
  warning: { background: '#FBE7D3', foreground: colors.warning },
  error: { background: '#F5DAD3', foreground: colors.error },
  muted: { background: colors.surfaceTertiary, foreground: colors.muted },
  info: { background: '#DCE6EA', foreground: colors.info }
};

export const Card = ({ children, className = '', testID }) => (
  <div data-testid={testID} className={`ui-card ${className}`}>{children}</div>
);

export const SectionTitle = ({ children, className = '' }) => (
  <h2 className={`ui-section-title ${className}`}>{children}</h2>
);

export const Divider = ({ className = '' }) => <div className={`ui-divider ${className}`} />;

export const Pill = ({ label, tone = 'brand', className = '' }) => {
  const selectedTone = toneStyles[tone] || toneStyles.brand;
  return <span className={`ui-pill ${className}`} style={{ backgroundColor: selectedTone.background, color: selectedTone.foreground }}>{label}</span>;
};

export const PrimaryButton = ({ label, onClick, disabled = false, className = '', testID, type = 'button' }) => (
  <button data-testid={testID} type={type} onClick={onClick} disabled={disabled} className={`ui-button ui-button-primary ${className}`}>
    {label}
  </button>
);

export const GhostButton = ({ label, onClick, disabled = false, className = '', testID, type = 'button' }) => (
  <button data-testid={testID} type={type} onClick={onClick} disabled={disabled} className={`ui-button ui-button-ghost ${className}`}>
    {label}
  </button>
);

export const Progress = ({ pct, color = colors.brandPrimary }) => (
  <div className="ui-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.max(0, pct))}>
    <div className="ui-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
  </div>
);
