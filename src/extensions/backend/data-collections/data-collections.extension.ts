import { extensions } from '@wix/astro/builders';
import assetsCollection from './assets';
import reservationsCollection from './reservations';
import reservationItemsCollection from './reservation-items';
import customersCollection from './customers';
import documentsCollection from './documents';
import paymentsCollection from './payments';
import inspectionsCollection from './inspections';
import activityLogCollection from './activity-log';
import appSettingsCollection from './app-settings';
import documentTemplatesCollection from './document-templates';

export default extensions.dataCollections({
  id: 'c1fe36e1-148a-4fed-91aa-ade5edec2a02',
  name: 'Data Collections',
  collections: [
    assetsCollection,
    reservationsCollection,
    reservationItemsCollection,
    customersCollection,
    documentsCollection,
    paymentsCollection,
    inspectionsCollection,
    activityLogCollection,
    appSettingsCollection,
    documentTemplatesCollection,
  ],
});
