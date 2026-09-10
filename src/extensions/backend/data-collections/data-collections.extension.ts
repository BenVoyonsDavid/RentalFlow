import { extensions } from '@wix/astro/builders';
import assetsCollection from './assets';
import reservationsCollection from './reservations';
import reservationItemsCollection from './reservation-items';
import customersCollection from './customers';

export default extensions.dataCollections({
  id: 'c1fe36e1-148a-4fed-91aa-ade5edec2a02',
  name: 'Data Collections',
  collections: [
    assetsCollection,
    reservationsCollection,
    reservationItemsCollection,
    customersCollection,
  ],
});
