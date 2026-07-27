import React from 'react';
import { Button } from 'antd';
import { PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { UI_COLORS } from '../../data';
import { useIsFrozen, toggleFrozen } from '../useFrozenCars';

// Tek paylaşılan Freeze/Favori butonu — kendi useIsFrozen(id) aboneliğini taşır.
// Böylece bir aracı freeze etmek yalnızca O aracın butonunu render eder; onu saran
// dev tabloyu (CarTable/MobileCarCards/Recommendations) ya da başka araçların
// butonlarını DEĞİL (bkz. useFrozenCars.js — Context değil, seçici store aboneliği).
export const FreezeButton = ({ listingId, showLabel = false, style }) => {
  const frozen = useIsFrozen(listingId);

  return (
    <Button
      type="text"
      size="small"
      aria-label="Favori"
      icon={frozen ? <PushpinFilled style={{ color: UI_COLORS.linkActive }} /> : <PushpinOutlined style={{ color: '#bbb' }} />}
      onClick={() => toggleFrozen(listingId)}
      style={showLabel ? { marginTop: 4, fontSize: '12px', color: frozen ? UI_COLORS.linkActive : undefined, ...style } : style}
    >
      {showLabel ? (frozen ? 'Unfreeze' : 'Freeze') : null}
    </Button>
  );
};
