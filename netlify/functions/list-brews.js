// Netlify serverless function — reads brews from the Coffee Recipe Logbook via
// the official Notion API (Phase 2 of the two-way sync, read side). The
// NOTION_TOKEN secret lives only here; the client receives normalized rows.

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
const LOGBOOK_DB_ID = process.env.NOTION_LOGBOOK_DB_ID || 'e746a40f6a324aff98cabb8d72fbe8ae'

const txt = (p) => p?.rich_text?.[0]?.plain_text || p?.title?.[0]?.plain_text || ''
const numv = (p) => (p?.number ?? null)

export const handler = async () => {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    return json(500, { error: 'NOTION_TOKEN is not configured on the server.' })
  }
  try {
    const res = await fetch(`${NOTION_API}/databases/${LOGBOOK_DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 50, sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
    })
    const body = await res.json()
    if (!res.ok) {
      return json(res.status, { error: body.message || 'Notion API error', code: body.code })
    }
    const brews = (body.results || []).map((pg) => {
      const pr = pg.properties || {}
      return {
        id: pg.id,
        url: pg.url,
        name: txt(pr['Brew Name']),
        method: pr['Brew Method']?.select?.name || '',
        date: pr['Date']?.date?.start || '',
        coffee: numv(pr['Coffee (g)']),
        ratio: numv(pr['Ratio']),
        totalWater: numv(pr['Total Water']),
        brewWater: numv(pr['Brew Water']),
        ice: numv(pr['Ice (g)']),
        milk: numv(pr['Milk (g)']),
        rating: numv(pr['Rating /10']),
        notes: txt(pr['Tasting Notes']),
        grindSize: txt(pr['Grind Size']),
        waterTemp: txt(pr['Water Temp']),
        bloomTime: txt(pr['Bloom Time']),
        pour1Time: txt(pr['Pour 1 Time']),
        pour2Time: txt(pr['Pour 2 Time']),
        pour3Time: txt(pr['Pour 3 Time']),
        drawdownTime: txt(pr['Drawdown Time']),
      }
    })
    return json(200, { brews })
  } catch (e) {
    return json(502, { error: `Failed to reach Notion: ${e.message}` })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }
}
