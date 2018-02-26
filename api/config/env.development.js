const path = require('path');

module.exports = {
  db: {
    uri:
      process.env.MONGOHQ_URL ||
      process.env.MONGODB_URI ||
      'mongodb://' +
        (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') +
        '/cms-dev',
    options: {
      user: '',
      pass: ''
    },
    // Enable mongoose debug mode
    debug: process.env.MONGODB_DEBUG || false
  },
  // redirectUrl should be the client service URL the github Oauth redirecting to
  redirectUrl: 'http://localhost:3000/',
  serverUrl: 'http://localhost:3000',
  cors: {
    // origin should be the client service hostname
    origin: 'http://localhost:3000',
    methods: 'POST,GET,OPTIONS,DELETE',
    credentials: true
  },

  clientPath: process.env.CLIENT_PATH || path.resolve(__dirname, '../../public/dev/index.html'),
  clientPathPublic: process.env.CLIENT_PATH || path.resolve(__dirname, '../../public/dev'),
};
