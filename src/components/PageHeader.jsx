import React from 'react';
import { Flex, Typography } from 'antd';
import { APP } from '../data';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <Flex vertical align="center" justify="center">
    <Title level={4}>{APP.header.title}</Title>
    <Text type="secondary">{APP.header.spec}</Text>
  </Flex>
);
