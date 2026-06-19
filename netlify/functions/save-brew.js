// Netlify serverless function — writes one brew to the Coffee Recipe Logbook via
// the official Notion API. The NOTION_TOKEN secret lives ONLY here (Netlify env
// var), never in the client bundle. Phase 1 of the two-way Notion sync (write).
//
// Prerequisites (see PRD §7 / Architecture):
//   - NOTION_TOKEN set in the environment (Netlify env var; local .env for dev).
//   - The Notion integration behind that token must be shared with the Logbook DB.

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
// Coffee Recipe Logbook database id (overridable via env).
const LOGBOOK_DB_ID = process.env.NOTION_LOGBOOK_DB_ID || 'e746a40f6a324aff98cabb8d72fbe8ae'

const richText = (s) => (s != null && s !== '' ? { rich_text: [{ text: { content: String(s) } }] } : undefined)
const number = (n) => (n == null || Number.isNaN(Number(n)) ? undefined : { number: Number(n) })
const select = (name) => (name ? { select: { name } } : undefined)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  const token = process.env.NOTION_TOKEN
  if (!token) {
    return json(500, { error: 'NOTION_TOKEN is not configured on the server.' })
  }

  let data
  try {
    data = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  // Map the incoming brew payload → Notion properties (blanks are omitted).
  // Property names must match the Logbook schema exactly.
  const props = {}
  const set = (key, value) => {
    if (value !== undefined) props[key] = value
  }
  set('Brew Name', { title: [{ text: { content: data.brewName || 'Brew' } }] })
  set('Brew Method', select(data.brewMethod))
  set('Coffee (g)', number(data.coffee))
  set('Ratio', number(data.ratio))
  set('Total Water', number(data.totalWater))
  set('Bloom Water', number(data.bloomWater))
  set('Brew Water', number(data.brewWater))
  set('Ice (g)', number(data.ice))
  set('Milk (g)', number(data.milk))
  set('Pour 1 Water', number(data.pour1Water))
  set('Pour 2 Water', number(data.pour2Water))
  set('Pour 3 Water', number(data.pour3Water))
  set('Bloom Time', richText(data.bloomTimeStr))
  set('Pour 1 Time', richText(data.pour1Time))
  set('Pour 2 Time', richText(data.pour2Time))
  set('Pour 3 Time', richText(data.pour3Time))
  set('Drawdown Time', richText(data.drawdownTime))
  set('Water Temp', richText(data.waterTemp))
  set('Grind Size', richText(data.grindSize))
  set('Rating /10', number(data.rating))
  set('Tasting Notes', richText(data.notes))
  if (data.date) set('Date', { date: { start: data.date } })

  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: LOGBOOK_DB_ID }, properties: props }),
    })
    const body = await res.json()
    if (!res.ok) {
      return json(res.status, { error: body.message || 'Notion API error', code: body.code })
    }
    return json(200, { id: body.id, url: body.url })
  } catch (e) {
    return json(502, { error: `Failed to reach Notion: ${e.message}` })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }
}
