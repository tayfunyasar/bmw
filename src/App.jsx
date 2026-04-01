import React from 'react';
import { ConfigProvider, Layout, Flex } from 'antd';
import { evaluatedListings } from './utils/pricingCalculator';
import { PageHeader } from './components/PageHeader';
import { Recommendations } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';

const { Content } = Layout;

const App = () => {
  return (
    <ConfigProvider>
      <Layout>
        <Content>
          <Flex vertical gap="middle">
            
            <PageHeader />

            <Recommendations evaluatedListings={evaluatedListings} />

            <MainTabs />
          </Flex>
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
