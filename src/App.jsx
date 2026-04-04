import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, Layout, Flex } from 'antd';
import { evaluatedListings } from './utils/pricingCalculator';
import { PageHeader } from './components/PageHeader';
import { Recommendations } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';

const { Content } = Layout;

const App = () => {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
};

export default App;
