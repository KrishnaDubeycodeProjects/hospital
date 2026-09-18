import React from 'react';

// Predefined global priority/ranking for the Top 8 Popular Departments
export const POPULAR_DEPARTMENT_KEYS = [
  'General Medicine',
  'Cardiology',
  'General Surgery',
  'Orthopaedics',
  'Obstetrics & Gynaecology',
  'Paediatrics',
  'Neurology',
  'Urology',
];

// Department Vector SVG Icons
export function DepartmentIcon({ type, color = 'currentColor', size = 18 }) {
  switch (type) {
    case 'stethoscope':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3" />
          <path d="M9 12.5V17a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-1.5" />
          <circle cx="16" cy="15" r="2.5" />
        </svg>
      );
    case 'heart':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          <path d="M3.22 12H9.5l1.5-3 2 6.5 1.5-3.5h6.28" />
        </svg>
      );
    case 'surgery':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 2 4 4-13 13H5v-4L18 2z" />
          <path d="m14.5 5.5 4 4" />
        </svg>
      );
    case 'bone':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 10c.7-.7 1.69-1 2.5-1a2.5 2.5 0 1 0-2.5 2.5v1a2.5 2.5 0 1 0 2.5 2.5c-.81 0-1.8-.3-2.5-1l-7 7c-.7.7-1 1.69-1 2.5a2.5 2.5 0 1 0-2.5-2.5h-1a2.5 2.5 0 1 0-2.5-2.5c0 .81.3 1.8 1 2.5l7-7Z" />
        </svg>
      );
    case 'obstetrics':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="5" />
          <path d="M12 13v8" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'paediatrics':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M6 19a6 6 0 0 1 12 0" />
          <circle cx="10" cy="6.5" r=".7" fill={color} />
          <circle cx="14" cy="6.5" r=".7" fill={color} />
          <path d="M10 8.5c.7.6 2.3.6 3 0" />
        </svg>
      );
    case 'neurology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .5.1 1 .3 1.5A4.5 4.5 0 0 0 3 12c0 2 1.3 3.7 3.1 4.3A4.5 4.5 0 0 0 10 20.5V22" />
          <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .5-.1 1-.3 1.5A4.5 4.5 0 0 1 21 12c0 2-1.3 3.7-3.1 4.3A4.5 4.5 0 0 1 14 20.5V22" />
          <path d="M12 2v20" />
          <path d="M8 7.5a2 2 0 0 0 4 0" />
          <path d="M12 15a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'urology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 5c-2.2 0-4 2.2-4 5 0 4.5 3 9 7 11 0-3 1-5 2-7-1.5-1-2.5-3-2.5-5 0-2.2-1.1-4-2.5-4z" />
          <path d="M18 5c2.2 0 4 2.2 4 5 0 4.5 3 9 7 11 0-3 1-5 2-7 1.5-1 2.5-3 2.5-5 0-2.2 1.1-4 2.5-4z" />
        </svg>
      );
    case 'family':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 19a6 6 0 0 1 12 0" />
          <path d="M15 19a4.5 4.5 0 0 1 7 0" />
        </svg>
      );
    case 'eye':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'tooth':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8 2 6 5 6 8c0 3 1.5 6 2 9 0 2 .5 5 2 5s1.5-2.5 2-5c.5 2.5.5 5 2 5s2-3 2-5c.5-3 2-6 2-9 0-3-2-6-6-6z" />
        </svg>
      );
    case 'pulmonology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v9" />
          <path d="M12 7a6 6 0 0 0-6 6c0 3 2 6 5 6h1" />
          <path d="M12 7a6 6 0 0 1 6 6c0 3-2 6-5 6h-1" />
        </svg>
      );
    case 'dermatology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 0 0-10 10c0 5.5 4.5 10 10 10s10-4.5 10-10A10 10 0 0 0 12 2zm1 14.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
        </svg>
      );
    case 'ent':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 4-2.5 6-3.5 7.5-.7 1.1-.5 2.5-.5 4a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2c0-2.5.5-3.5 1.5-5" />
          <path d="M11 11a2 2 0 0 1 2 2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="4" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

/**
 * Returns pastel styling and vector icon configuration for any department name.
 */
export function getDepartmentVisual(rawName = '') {
  const name = (rawName || '').trim();
  const lower = name.toLowerCase();

  // 1. General Medicine
  if (lower.includes('general medicine') || lower.includes('internal medicine')) {
    return {
      displayName: 'General Medicine',
      fullLabel: name,
      pastelBg: '#D1FAE5', // Soft Mint
      borderColor: '#A7F3D0',
      iconColor: '#059669',
      type: 'stethoscope',
    };
  }

  // 2. Cardiology
  if (lower.includes('cardiology') && !lower.includes('surgery') && !lower.includes('paediatric')) {
    return {
      displayName: 'Cardiology',
      fullLabel: name,
      pastelBg: '#FFE4E6', // Soft Rose/Pink
      borderColor: '#FECDD3',
      iconColor: '#E11D48',
      type: 'heart',
    };
  }

  // 3. General Surgery
  if (lower.includes('general surgery')) {
    return {
      displayName: 'General Surgery',
      fullLabel: name,
      pastelBg: '#E0F2FE', // Soft Sky Blue
      borderColor: '#BAE6FD',
      iconColor: '#0284C7',
      type: 'surgery',
    };
  }

  // 4. Orthopaedics
  if (lower.includes('orthopaed') || lower.includes('orthoped')) {
    return {
      displayName: 'Orthopaedics',
      fullLabel: name,
      pastelBg: '#FEF3C7', // Soft Amber/Yellow
      borderColor: '#FDE68A',
      iconColor: '#D97706',
      type: 'bone',
    };
  }

  // 5. Obstetrics & Gynaecology
  if (lower.includes('gynaec') || lower.includes('obstetric') || lower.includes('women')) {
    return {
      displayName: 'Obstetrics & Gynae',
      fullLabel: name,
      pastelBg: '#FCE7F3', // Soft Pink
      borderColor: '#FBCFE8',
      iconColor: '#DB2777',
      type: 'obstetrics',
    };
  }

  // 6. Paediatrics
  if (lower.includes('paediatric') || lower.includes('pediatric') || lower.includes('child')) {
    return {
      displayName: lower.includes('cardiology') ? 'Paediatric Cardiology' : 'Paediatrics',
      fullLabel: name,
      pastelBg: '#F3E8FF', // Soft Lavender/Purple
      borderColor: '#E9D5FF',
      iconColor: '#9333EA',
      type: 'paediatrics',
    };
  }

  // 7. Neurology
  if (lower.includes('neurolog') && !lower.includes('surgery')) {
    return {
      displayName: 'Neurology',
      fullLabel: name,
      pastelBg: '#EDE9FE', // Soft Violet
      borderColor: '#DDD6FE',
      iconColor: '#7C3AED',
      type: 'neurology',
    };
  }

  // 8. Urology
  if (lower.includes('urolog')) {
    return {
      displayName: 'Urology',
      fullLabel: name,
      pastelBg: '#CCFBF1', // Soft Mint/Teal
      borderColor: '#99F6E4',
      iconColor: '#0D9488',
      type: 'urology',
    };
  }

  // Other Common Specialties
  if (lower.includes('family medicine')) {
    return {
      displayName: 'Family Medicine',
      fullLabel: name,
      pastelBg: '#FFE4E6',
      borderColor: '#FECDD3',
      iconColor: '#E11D48',
      type: 'family',
    };
  }

  if (lower.includes('cardiac surgery')) {
    return {
      displayName: 'Cardiac Surgery',
      fullLabel: name,
      pastelBg: '#FEF3C7',
      borderColor: '#FDE68A',
      iconColor: '#D97706',
      type: 'bone',
    };
  }

  if (lower.includes('ophthalmolog') || lower.includes('eye')) {
    return {
      displayName: 'Ophthalmology',
      fullLabel: name,
      pastelBg: '#CFFAFE',
      borderColor: '#A5F3FC',
      iconColor: '#0891B2',
      type: 'eye',
    };
  }

  if (lower.includes('dent')) {
    return {
      displayName: 'Dentistry',
      fullLabel: name,
      pastelBg: '#E0F2FE',
      borderColor: '#BAE6FD',
      iconColor: '#2563EB',
      type: 'tooth',
    };
  }

  if (lower.includes('pulmonolog') || lower.includes('chest') || lower.includes('respiratory')) {
    return {
      displayName: 'Pulmonology',
      fullLabel: name,
      pastelBg: '#CCFBF1',
      borderColor: '#99F6E4',
      iconColor: '#0D9488',
      type: 'pulmonology',
    };
  }

  if (lower.includes('dermatolog') || lower.includes('skin')) {
    return {
      displayName: 'Dermatology',
      fullLabel: name,
      pastelBg: '#FFEDD5',
      borderColor: '#FED7AA',
      iconColor: '#EA580C',
      type: 'dermatology',
    };
  }

  if (lower.includes('ent') || lower.includes('otorhinolaryngology')) {
    return {
      displayName: 'ENT',
      fullLabel: name,
      pastelBg: '#E0F2FE',
      borderColor: '#BAE6FD',
      iconColor: '#0284C7',
      type: 'ent',
    };
  }

  if (lower.includes('nephrolog')) {
    return {
      displayName: 'Nephrology',
      fullLabel: name,
      pastelBg: '#E0E7FF',
      borderColor: '#C7D2FE',
      iconColor: '#4F46E5',
      type: 'urology',
    };
  }

  // Default fallback
  return {
    displayName: name,
    fullLabel: name,
    pastelBg: '#F1F5F9',
    borderColor: '#E2E8F0',
    iconColor: '#0284C7',
    type: 'default',
  };
}
