import { Route, Routes } from 'react-router-dom';

import ExternalIpListPage from './ExternalIpListPage';
import ExternalIpWizardPage from './ExternalIpWizardPage';

const ExternalIpRoutes = () => (
  <Routes>
    <Route index element={<ExternalIpListPage />} />
    <Route path="create" element={<ExternalIpWizardPage />} />
  </Routes>
);

export default ExternalIpRoutes;
