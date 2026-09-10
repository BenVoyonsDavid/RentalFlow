import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';
import dataCollections from './extensions/backend/data-collections/data-collections.extension.ts';

export default app()
  .use(myPage)
  .use(dataCollections);
