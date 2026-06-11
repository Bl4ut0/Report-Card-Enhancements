import 'dotenv/config';

async function main() {
  const apiKey = process.env.WCL_V1_API_KEY;
  if (!apiKey) {
    throw new Error('WCL_V1_API_KEY environment variable is not defined. Please configure it in your .env file.');
  }
  const reportCode = '1XPTmVrMBQkAbFG2';
  
  // Let's test Sikkab (ID 11)
  const targetId = 9; 
  
  // URL format: https://classic.warcraftlogs.com/v1/report/events/buffs/:code?api_key=:apiKey&targetid=:targetid&by=source&filter=ability.id IN (35476)
  const urlWithBySource = `https://classic.warcraftlogs.com/v1/report/events/buffs/${reportCode}?api_key=${apiKey}&targetid=${targetId}&by=source&filter=ability.id%20IN%20%2835476%29`;
  const urlWithoutBySource = `https://classic.warcraftlogs.com/v1/report/events/buffs/${reportCode}?api_key=${apiKey}&targetid=${targetId}&filter=ability.id%20IN%20%2835476%29`;
  const urlWithSourceId = `https://classic.warcraftlogs.com/v1/report/events/buffs/${reportCode}?api_key=${apiKey}&sourceid=${targetId}&filter=ability.id%20IN%20%2835476%29`;

  console.log('Fetching with by=source...');
  const res1 = await fetch(urlWithBySource).then(r => r.json());
  console.log(`With by=source: found ${res1.events ? res1.events.length : 0} events.`);
  if (res1.events && res1.events.length > 0) {
    console.log('First event:', res1.events[0]);
  }

  console.log('\nFetching without by=source...');
  const res2 = await fetch(urlWithoutBySource).then(r => r.json());
  console.log(`Without by=source: found ${res2.events ? res2.events.length : 0} events.`);
  if (res2.events && res2.events.length > 0) {
    console.log('First event:', res2.events[0]);
  }

  console.log('\nFetching with sourceid instead...');
  const res3 = await fetch(urlWithSourceId).then(r => r.json());
  console.log(`With sourceid: found ${res3.events ? res3.events.length : 0} events.`);
  if (res3.events && res3.events.length > 0) {
    console.log('First event:', res3.events[0]);
  }
}

main().catch(console.error);
