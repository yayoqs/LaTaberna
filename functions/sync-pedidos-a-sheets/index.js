const { Client } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

module.exports = async function(context) {
  try {
    const result = await client.ping();
    context.log('Ping exitoso: ' + result);
    return context.res.text('OK');
  } catch (e) {
    context.log('Error: ' + e.message);
    return context.res.text('Error: ' + e.message, 500);
  }
};