import type { TFunction } from 'i18next';

import type { ApiTransport } from '../config/appConfig';

export interface TransportNotice {
  label: string;
  body: string;
}

export const getTransportNotice = (
  t: TFunction,
  transport: ApiTransport,
): TransportNotice => {
  if (transport === 'http') {
    return {
      label: t('privacy.transportHttpLabel'),
      body: t('privacy.transportHttpText'),
    };
  }

  if (transport === 'stub') {
    return {
      label: t('privacy.transportStubLabel'),
      body: t('privacy.transportStubText'),
    };
  }

  return {
    label: t('privacy.transportLocalLabel'),
    body: t('privacy.transportLocalText'),
  };
};
