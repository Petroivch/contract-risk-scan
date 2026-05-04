import { normalizeSearchText, uniqueStrings } from '../analysis/textNormalization';
import type { SupportedLanguage } from '../i18n/types';

export const presetRoleIds = ['performer', 'employer', 'customer', 'contractor'] as const;

export type PresetRoleId = (typeof presetRoleIds)[number];

interface PresetRoleDefinition {
  id: PresetRoleId;
  translationKey: `roles.${PresetRoleId}`;
  labels: Record<SupportedLanguage, string>;
  aliases: string[];
}

const presetRoleDefinitions: Record<PresetRoleId, PresetRoleDefinition> = {
  performer: {
    id: 'performer',
    translationKey: 'roles.performer',
    labels: {
      ru: 'Исполнитель',
      en: 'Performer',
      it: 'Esecutore',
      fr: 'Exécutant',
    },
    aliases: [
      'исполнитель услуг',
      'поставщик услуг',
      'service provider',
      'provider',
      'executor',
      'vendor',
      'prestatore',
      'fornitore',
      'prestataire',
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
    aliases: ['наниматель', 'hirer', 'hiring party', 'employing party', 'datore'],
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
      'клиент',
      'покупатель',
      'получатель',
      'заявитель',
      'buyer',
      'purchaser',
      'recipient',
      'applicant',
      'cliente',
      'committente',
      'acquirente',
      'acheteur',
      'demandeur',
      'beneficiaire',
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
      'субподрядчик',
      'subcontractor',
      'builder',
      'supplier',
      'appaltatore',
      'subappaltatore',
      'entrepreneur',
      'sous-traitant',
    ],
  },
};

const presetRoleLookup = new Map<string, PresetRoleId>();

for (const definition of Object.values(presetRoleDefinitions)) {
  const lookupValues = [
    definition.id,
    definition.translationKey,
    ...Object.values(definition.labels),
    ...definition.aliases,
  ];

  for (const value of lookupValues) {
    const normalizedValue = normalizeSearchText(value);
    if (normalizedValue) {
      presetRoleLookup.set(normalizedValue, definition.id);
    }
  }
}

export const resolvePresetRoleId = (value: string): PresetRoleId | undefined => {
  const normalizedValue = normalizeSearchText(value);
  return normalizedValue ? presetRoleLookup.get(normalizedValue) : undefined;
};

export const resolveConfiguredPresetRoleIds = (values: string[]): PresetRoleId[] => {
  const resolved = values
    .map((value) => resolvePresetRoleId(value))
    .filter((value): value is PresetRoleId => Boolean(value));

  return uniqueStrings(resolved) as PresetRoleId[];
};

export const getPresetRoleLabel = (
  presetRoleId: PresetRoleId,
  language: SupportedLanguage,
): string => {
  return presetRoleDefinitions[presetRoleId].labels[language];
};

export const getPresetRoleOptions = (
  configuredPresetRoleIds: PresetRoleId[],
  language: SupportedLanguage,
): Array<{ id: PresetRoleId; label: string }> => {
  return configuredPresetRoleIds.map((presetRoleId) => ({
    id: presetRoleId,
    label: getPresetRoleLabel(presetRoleId, language),
  }));
};

export const buildPresetRoleTerms = (selectedRole: string): string[] => {
  const presetRoleId = resolvePresetRoleId(selectedRole);
  if (!presetRoleId) {
    return [];
  }

  const definition = presetRoleDefinitions[presetRoleId];
  return uniqueStrings(
    [definition.id, ...Object.values(definition.labels), ...definition.aliases]
      .map((value) => normalizeSearchText(value))
      .filter(Boolean),
  );
};
