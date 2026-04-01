import React from 'react';
import { Flex, Typography } from 'antd';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <Flex vertical align="center" justify="center">
    <Title level={4}>BMW M440i xDrive Coupé — G22 Karşılaştırma</Title>
    <Text type="secondary">374 HP • 3.0L I6 Twin-Turbo • ZF 8-Speed • xDrive AWD</Text>
  </Flex>
);
