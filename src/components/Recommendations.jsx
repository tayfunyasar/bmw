import React from 'react';
import { Card, Flex, Typography } from 'antd';
import { getPickLabel } from '../utils/helpers';

const { Text, Link } = Typography;

export const Recommendations = ({ evaluatedListings }) => (
  <Card title="🎯 Claude'un Önerileri">
    <Flex gap="middle" wrap="wrap">
      {evaluatedListings.filter(car => car.curatorPickBadge).map((car, index) => (
        <Card key={index} hoverable type="inner" size="small">
          <Flex vertical align="center">
            <Text>{car.curatorPickBadge}</Text>
            <Link href={car.listingUrl} target="_blank" rel="noopener noreferrer" strong>{car.listingId} {car.locationCity}</Link>
            <Text type="secondary">€{car.basePriceEuro.toLocaleString()} • {car.mileageKm.toLocaleString()} km</Text>
            <Text type="secondary">
              {getPickLabel(car.curatorPickBadge)}
            </Text>
          </Flex>
        </Card>
      ))}
    </Flex>
  </Card>
);
