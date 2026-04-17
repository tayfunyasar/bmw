import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, Layout, Flex } from 'antd';
import { allByTotalCost } from './utils/pricingCalculator';
import { PageHeader } from './components/PageHeader';
import { Recommendations, computeSuggestedIds } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';
import { FrozenCarsProvider } from './components/FrozenCarsContext';

const { Content } = Layout;

const App = () => {
  const suggestedIds = computeSuggestedIds(allByTotalCost);
  return (
    <BrowserRouter>
      <ConfigProvider>
        <FrozenCarsProvider initialIds={suggestedIds}>
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
