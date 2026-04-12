import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, Layout, Flex } from 'antd';
import { allByTotalCost } from './utils/pricingCalculator';
import { PageHeader } from './components/PageHeader';
import { Recommendations } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';
import { FrozenCarsProvider } from './components/FrozenCarsContext';

const { Content } = Layout;

const App = () => {
  return (
    <BrowserRouter>
      <ConfigProvider>
        <FrozenCarsProvider>
          <Layout>
            <Content>
              <Flex vertical gap="middle">

                <PageHeader />

                <Recommendations evaluatedListings={allByTotalCost} />

                <MainTabs />
              </Flex>
            </Content>
          </Layout>
        </FrozenCarsProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
};

export default App;
