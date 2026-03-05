'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/homepage',
      handler: 'homepage.find',
    },
    {
      method: 'PUT',
      path: '/homepage',
      handler: 'homepage.update',
    },
    {
      method: 'DELETE',
      path: '/homepage',
      handler: 'homepage.delete',
    },
  ],
};
