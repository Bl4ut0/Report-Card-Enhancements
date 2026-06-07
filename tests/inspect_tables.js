import 'dotenv/config';
import { V2Client } from './lib/v2_client.js';

const CONFIG = {
  v2ClientId: process.env.WCL_V2_CLIENT_ID,
  v2ClientSecret: process.env.WCL_V2_CLIENT_SECRET,
};

async function main() {
  const v2Client = new V2Client(CONFIG.v2ClientId, CONFIG.v2ClientSecret);
  await v2Client.getAccessToken();

  const query = `
    query {
      __type(name: "Report") {
        fields {
          name
          args {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  `;

  console.log("Sending introspection query...");
  const response = await v2Client.graphqlQuery(query);
  const reportFields = response?.data?.__type?.fields || [];
  const eventsField = reportFields.find(f => f.name === 'events');

  if (eventsField) {
    console.log("\nArguments for 'events' field on Report:");
    console.log(JSON.stringify(eventsField.args, null, 2));
  } else {
    console.log("\nCould not find 'events' field on Report.");
  }
}

main().catch(console.error);
