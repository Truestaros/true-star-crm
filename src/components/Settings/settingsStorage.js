const SETTINGS_STORAGE_KEY = 'tsos-crm-settings-v1';

const MEMBER_STATUS = ['active', 'invited', 'disabled'];
const FALLBACK_TIME_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
];

const DEFAULT_TERMS_AND_CONDITIONS = [
  'Warranty: Contractor warrants that services will be performed in a professional and workmanlike manner consistent with industry standards. Unless otherwise stated in writing, any workmanship concern reported within thirty (30) days of service completion will be reviewed and corrected at no additional labor charge.',
  '',
  'Non-Payment: Invoices are due according to the payment terms listed in this proposal. Past-due balances may accrue a service charge of 1.5% per month (or the maximum amount allowed by law). Contractor reserves the right to suspend services on accounts more than thirty (30) days past due. Customer is responsible for reasonable costs of collection, including attorney fees, if collection action is required.',
].join('\n');

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

const DEFAULT_SETTINGS = {
  businessName: 'True Star Outdoor Solutions',
  businessAddress: '',
  website: '',
  logoDataUrl: '',
  timeZone: getBrowserTimeZone(),
  primaryColor: '#5a7a5f',
  secondaryColor: '#3d5942',
  contractTermMonths: 12,
  minMarginGatePct: 35,
  termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS,
  members: [
    {
      id: 'member-owner-admin',
      name: 'Owner Admin',
      email: 'owner@truestar.local',
      role: 'Admin',
      status: 'active',
      lastPasswordResetAt: null,
    },
  ],
};

function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());
}

function normalizeColor(value, fallback) {
  const next = String(value || '').trim();
  return isHexColor(next) ? next.toLowerCase() : fallback;
}

function normalizeMember(member, index) {
  const fallbackName = `Team Member ${index + 1}`;
  const status = MEMBER_STATUS.includes(member?.status) ? member.status : 'active';
  const parsedReset = member?.lastPasswordResetAt ? new Date(member.lastPasswordResetAt) : null;

  return {
    id: member?.id || `member-${index + 1}`,
    name: (member?.name || fallbackName).trim(),
    email: (member?.email || '').trim().toLowerCase(),
    role: (member?.role || 'ReadOnly').trim(),
    status,
    lastPasswordResetAt: parsedReset && !Number.isNaN(parsedReset.getTime()) ? parsedReset.toISOString() : null,
  };
}

function normalizeSettings(rawSettings = {}) {
  const members = Array.isArray(rawSettings.members) && rawSettings.members.length > 0
    ? rawSettings.members.map(normalizeMember)
    : DEFAULT_SETTINGS.members;

  const businessName = String(rawSettings.businessName || '').trim() || DEFAULT_SETTINGS.businessName;
  const businessAddress = String(rawSettings.businessAddress || '').trim();
  const website = String(rawSettings.website || '').trim();
  const logoDataUrl = String(rawSettings.logoDataUrl || '').trim();
  const timeZone = String(rawSettings.timeZone || '').trim() || DEFAULT_SETTINGS.timeZone;
  const contractTermMonths = Math.max(
    1,
    Math.round(Number(rawSettings.contractTermMonths || DEFAULT_SETTINGS.contractTermMonths)),
  );
  const minMarginGatePct = Math.max(
    0,
    Number(rawSettings.minMarginGatePct ?? DEFAULT_SETTINGS.minMarginGatePct),
  );
  const termsAndConditions = String(
    rawSettings.termsAndConditions ?? DEFAULT_SETTINGS.termsAndConditions,
  );

  // Migrate from old Apple-blue defaults to True Star brand green
  const OLD_PRIMARY = '#007aff';
  const OLD_SECONDARY = '#0051d5';
  const rawPrimary = String(rawSettings.primaryColor || '').trim().toLowerCase();
  const rawSecondary = String(rawSettings.secondaryColor || '').trim().toLowerCase();
  const migratedPrimary = rawPrimary === OLD_PRIMARY ? DEFAULT_SETTINGS.primaryColor : normalizeColor(rawSettings.primaryColor, DEFAULT_SETTINGS.primaryColor);
  const migratedSecondary = rawSecondary === OLD_SECONDARY ? DEFAULT_SETTINGS.secondaryColor : normalizeColor(rawSettings.secondaryColor, DEFAULT_SETTINGS.secondaryColor);

  return {
    businessName,
    businessAddress,
    website,
    logoDataUrl,
    timeZone,
    primaryColor: migratedPrimary,
    secondaryColor: migratedSecondary,
    contractTermMonths,
    minMarginGatePct,
    termsAndConditions,
    members,
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  // Async sync to Supabase — fire and forget, localStorage is the local cache
  import('../../lib/db').then(({ saveSettingsToDb }) => {
    saveSettingsToDb(normalized).catch((err) => console.warn('Settings sync to Supabase failed:', err));
  });
  window.dispatchEvent(new Event('crm-settings-updated'));
  return normalized;
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  const int = Number.parseInt(clean, 16);
  if (Number.isNaN(int)) {
    return `rgba(0, 122, 255, ${alpha})`;
  }

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyThemeColors(settings) {
  const normalized = normalizeSettings(settings);
  const root = document.documentElement;
  root.style.setProperty('--accent', normalized.primaryColor);
  root.style.setProperty('--accent-dark', normalized.secondaryColor);
  root.style.setProperty('--accent-hover', hexToRgba(normalized.primaryColor, 0.1));
}

function getSupportedTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Ignore and fall back.
  }
  return FALLBACK_TIME_ZONES;
}

export {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  isHexColor,
  normalizeSettings,
  loadSettings,
  saveSettings,
  applyThemeColors,
  getSupportedTimeZones,
};
