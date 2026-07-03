import { writeFile, mkdir } from 'node:fs/promises';

const AIRPORT = process.env.AIRPORT_ICAO || 'EBLG';
const API_KEY = process.env.FR24_API_KEY;

if (!API_KEY) {
  console.error('Missing FR24_API_KEY environment variable (set it as a repo secret).');
  process.exit(1);
}

const url = `https://fr24api.flightradar24.com/api/live/flight-positions/full?airports=inbound:${AIRPORT}`;

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Accept-Version': 'v1',
    Accept: 'application/json',
  },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`FR24 API error ${res.status}: ${body}`);
  process.exit(1);
}

const json = await res.json();
const rows = Array.isArray(json) ? json : (json.data ?? []);

const flights = rows.map((f) => ({
  id: f.fr24_id ?? f.hex ?? f.reg,
  callsign: f.callsign ?? f.flight ?? '',
  airline: f.operating_as ?? f.painted_as ?? '',
  lat: f.lat,
  lon: f.lon,
  track: f.track ?? 0,
  altitude: f.alt ?? null,
  speed: f.gspeed ?? null,
  origin: f.orig_iata ?? f.orig_icao ?? '',
  destination: f.dest_iata ?? f.dest_icao ?? '',
  eta: f.eta ?? null,
})).filter((f) => typeof f.lat === 'number' && typeof f.lon === 'number');

const output = {
  airport: AIRPORT,
  updatedAt: new Date().toISOString(),
  flights,
};

await mkdir('data', { recursive: true });
await writeFile('data/flights.json', JSON.stringify(output, null, 2));
console.log(`Wrote ${flights.length} flight(s) to data/flights.json`);
