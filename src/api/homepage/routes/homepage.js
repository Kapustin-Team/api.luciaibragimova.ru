'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/api/homepage',
      handler: 'homepage.find',
    },
    {
      method: 'PUT',
      path: '/api/homepage',
      handler: 'homepage.update',
    },
    {
      method: 'DELETE',
      path: '/api/homepage',
      handler: 'homepage.delete',
    },
  ],
};
