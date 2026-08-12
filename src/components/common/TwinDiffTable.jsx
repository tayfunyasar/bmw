import React from 'react';
import { diffListings } from '../../utils/listingDiff';

// Ikiz kayit celiski tablosu — TEK kaynak. Hem masaustu tablosunun tooltip'i hem
// mobil kartin sari kutusu bunu kullanir; tablo iki yerde elle kurulamaz.
// Renkler bilerek inherit: koyu (tooltip) ve acik (kart) zeminde ayni bilesken calisir.
export const TwinDiffTable = ({ car, twin }) => {
  const diffs = diffListings(car, twin);
  if (diffs.length === 0) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: 'left', opacity: 0.7 }}>
          <th style={{ fontWeight: 500, padding: '2px 5px' }}>Alan</th>
          <th style={{ fontWeight: 500, padding: '2px 5px' }}>{car.listingId}</th>
          <th style={{ fontWeight: 500, padding: '2px 5px' }}>{twin.listingId}</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map(d => (
          <tr key={d.key} style={{ borderTop: '1px solid rgba(128,128,128,0.25)' }}>
            <td style={{ padding: '2px 5px', opacity: 0.75 }}>{d.label}</td>
            <td style={{ padding: '2px 5px' }}>{d.a}</td>
            <td style={{ padding: '2px 5px' }}>{d.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
