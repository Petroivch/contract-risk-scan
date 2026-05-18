import type { SupportedLanguage } from '../i18n/types';

export const presetRoleIds = ['performer', 'employer', 'customer', 'contractor'] as const;

export type RolePresetId = (typeof presetRoleIds)[number];

interface RolePresetDefinition {
  id: RolePresetId;
  translationKey: `roles.${RolePresetId}`;
  labels: Record<SupportedLanguage, string>;
  aliases: string[];
}

const ROLE_PRESETS: Record<RolePresetId, RolePresetDefinition> = {
  performer: {
    id: 'performer',
    translationKey: 'roles.performer',
    labels: {
      ru: 'Исполнитель',
      en: 'Performer',
      it: 'Esecutore',
      fr: 'Executant',
    },
    aliases: [
      'исполнитель',
      'исполнитель услуг',
      'поставщик',
      'agent',
      'vendor',
      'supplier',
      'service provider',
      'esecutore',
      'fornitore',
      'fournisseur',
    ],
  },
  employer: {
    id: 'employer',
    translationKey: 'roles.employer',
    labels: {
      ru: 'Работодатель',
      en: 'Employer',
      it: 'Datore di lavoro',
      fr: 'Employeur',
    },
    aliases: [
      'работодатель',
      'наниматель',
      'компания',
      'организация',
      'employer',
      'company',
      'organization',
      'datore di lavoro',
      'societa',
      'organizzazione',
      'employeur',
      'societe',
      'organisation',
    ],
  },
  customer: {
    id: 'customer',
    translationKey: 'roles.customer',
    labels: {
      ru: 'Заказчик',
      en: 'Customer',
      it: 'Cliente',
      fr: 'Client',
    },
    aliases: [
      'заказчик',
      'клиент',
      'покупатель',
      'принципал',
      'комитент',
      'customer',
      'client',
      'buyer',
      'principal',
      'cliente',
      'acquirente',
      'committente',
      'acheteur',
      'donneur d ordre',
    ],
  },
  contractor: {
    id: 'contractor',
    translationKey: 'roles.contractor',
    labels: {
      ru: 'Подрядчик',
      en: 'Contractor',
      it: 'Contraente',
      fr: 'Prestataire',
    },
    aliases: [
      'подрядчик',
      'исполнитель',
      'субподрядчик',
      'contractor',
      'subcontractor',
      'provider',
      'contraente',
      'appaltatore',
      'prestataire',
      'sous-traitant',
    ],
  },
};

const normalizeRoleValue = (value: string): string => {
  const normalized = typeof value.normalize === 'function' ? value.normalize('NFKD') : value;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
};

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalizeRoleValue(normalized);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);
  }

  return output;
};

const rolePresetEntries = Object.values(ROLE_PRESETS);

export const resolvePresetRoleId = (value: string | null | undefined): RolePresetId | undefined => {
  return resolveRolePresetId(value);
};

export const resolveRolePresetId = (value: string | null | undefined): RolePresetId | undefined => {
  const normalizedValue = normalizeRoleValue(value ?? '');
  if (!normalizedValue) {
    return undefined;
  }

  for (const preset of rolePresetEntries) {
    if (normalizedValue === preset.id) {
      return preset.id;
    }

    const knownValues = [
      preset.translationKey,
      ...Object.values(preset.labels),
      ...preset.aliases,
    ];
    if (knownValues.some((candidate) => normalizeRoleValue(candidate) === normalizedValue)) {
      return preset.id;
    }
  }

  return undefined;
};

export const resolveConfiguredPresetRoleIds = (values: string[]): RolePresetId[] => {
  const resolved = values
    .map((value) => resolveRolePresetId(value))
    .filter((value): value is RolePresetId => Boolean(value));

  return uniqueStrings(resolved) as RolePresetId[];
};

export const getPresetRoleLabel = (
  presetRoleId: RolePresetId,
  language: SupportedLanguage,
): string => {
  return ROLE_PRESETS[presetRoleId].labels[language];
};

export const getPresetRoleOptions = (
  configuredPresetRoleIds: RolePresetId[],
  language: SupportedLanguage,
): Array<{ id: RolePresetId; label: string }> => {
  return configuredPresetRoleIds.map((presetRoleId) => ({
    id: presetRoleId,
    label: getPresetRoleLabel(presetRoleId, language),
  }));
};

export const localizeRoleLabel = (
  value: string | null | undefined,
  language: SupportedLanguage,
): string => {
  const presetId = resolveRolePresetId(value);
  if (!presetId) {
    return (value ?? '').trim();
  }

  return ROLE_PRESETS[presetId].labels[language];
};

export const expandPresetRoleTerms = (
  value: string | null | undefined,
  includeAliases = true,
): string[] => {
  const presetId = resolveRolePresetId(value);
  if (!presetId) {
    return [];
  }

  const preset = ROLE_PRESETS[presetId];
  return uniqueStrings([
    preset.id,
    ...Object.values(preset.labels),
    ...(includeAliases ? preset.aliases : []),
  ]);
};

export const buildPresetRoleTerms = (
  value: string | null | undefined,
  includeAliases = true,
): string[] => {
  return expandPresetRoleTerms(value, includeAliases);
};


