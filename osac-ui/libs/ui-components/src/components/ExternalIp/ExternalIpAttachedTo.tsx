import { Link } from 'react-router-dom';
import { Content } from '@patternfly/react-core';

import { attachedTargetKindLabel } from './utils';
import type { ExternalIpAttachedTarget } from '../../api/v1/external-ip-data';
import { useTranslation } from '../../hooks/useTranslation';

interface ExternalIpAttachedToProps {
  attached?: boolean;
  target?: ExternalIpAttachedTarget;
}

const ExternalIpAttachedTo = ({ attached, target }: ExternalIpAttachedToProps) => {
  const { t } = useTranslation();

  if (!attached || !target) {
    return null;
  }

  const kindLabel = attachedTargetKindLabel(t, target.kind);

  return (
    <Content component="small">
      {kindLabel}{' '}
      <Link
        to={target.href}
        aria-label={t('{{kind}}: {{name}}', { kind: kindLabel, name: target.name })}
      >
        {target.name}
      </Link>
    </Content>
  );
};

export default ExternalIpAttachedTo;
