// Claude Tool Use 아겐틱 루프 핸들러
// 최대 5라운드: Claude가 도구를 호출 → 실행 → 결과 재전송 → 최종 텍스트 반환
import YahooFinanceClass from 'yahoo-finance2'
import { computeIndicators } from '../src/api/technicalApi.js'
import { getCorpMap } from './dartHandler.js'
import { getCikMap } from './edgarHandler.js'

const yf = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

const MAX_ROUNDS   = 5
const EDGAR_UA     = 'MyPortfolioHub/1.0 (portfolio@hub.local)'
const EDGAR_FORMS  = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K', 'DEF 14A'])

// ── ticker 정규화 ────────────────────────────────────────────────────
function toYFTicker(ticker, market) {
  const clean = ticker.replace(/\.(KS|KQ)$/i, '')
  if (market === 'KRX')    return `${clean}.KS`
  if (market === 'KOSDAQ') return `${clean}.KQ`
  return ticker
}

// ── 도구 정의 (Claude API tools 배열) ───────────────────────────────
export const RESEARCH_TOOLS = [
  {
    name: 'get_quote',
    description: '종목의 현재 시세 조회 — 현재가, 변동률, 거래량, 52주 고저, 시가총액, PER/PBR',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: '종목 코드 (예: 005930, AAPL)' },
        market: { type: 'string', description: 'KRX | KOSDAQ | NYSE | NASDAQ | ETF' },
      },
      required: ['ticker', 'market'],
    },
  },
  {
    name: 'get_profile',
    description: '재무 지표 조회 — 섹터/업종, ROE, 부채비율, 영업이익률, 배당수익률, 목표주가, 애널리스트 추천',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        market: { type: 'string' },
      },
      required: ['ticker', 'market'],
    },
  },
  {
    name: 'get_technical',
    description: '기술적 지표 조회 — MA20/60/120, RSI(14), MACD(12,26,9), 지지선/저항선 (최근 6개월 기준)',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        market: { type: 'string' },
      },
      required: ['ticker', 'market'],
    },
  },
  {
    name: 'get_news',
    description: '종목의 최근 뉴스 조회 — 제목, 출처, 날짜 (최대 5건)',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        market: { type: 'string' },
      },
      required: ['ticker', 'market'],
    },
  },
  {
    name: 'get_disclosures',
    description: '최근 공시 조회 — 한국 종목은 DART, 미국 종목은 SEC EDGAR (최대 10건)',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        market: { type: 'string' },
        days:   { type: 'number', description: '조회 기간(일), 기본 30' },
      },
      required: ['ticker', 'market'],
    },
  },
]

// ── 도구 실행 함수들 ─────────────────────────────────────────────────
async function runGetQuote(ticker, market) {
  try {
    const q = await yf.quote(toYFTicker(ticker, market))
    return {
      ticker,
      market,
      currentPrice:  q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent,
      volume:        q.regularMarketVolume,
      marketCap:     q.marketCap,
      high52w:       q.fiftyTwoWeekHigh,
      low52w:        q.fiftyTwoWeekLow,
      per:           q.trailingPE,
      pbr:           q.priceToBook,
    }
  } catch (e) {
    return { error: `시세 조회 실패: ${e.message}` }
  }
}

async function runGetProfile(ticker, market) {
  try {
    const s = await yf.quoteSummary(toYFTicker(ticker, market), {
      modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'],
    })
    const p = s.summaryProfile       ?? {}
    const f = s.financialData        ?? {}
    const k = s.defaultKeyStatistics ?? {}
    return {
      sector:            p.sector,
      industry:          p.industry,
      returnOnEquity:    f.returnOnEquity,
      debtToEquity:      f.debtToEquity,
      operatingMargin:   f.operatingMargins,
      netMargin:         f.profitMargins,
      revenueGrowth:     f.revenueGrowth,
      dividendYield:     k.dividendYield,
      targetMeanPrice:   f.targetMeanPrice,
      recommendationKey: f.recommendationKey,
    }
  } catch (e) {
    return { error: `재무 지표 조회 실패: ${e.message}` }
  }
}

async function runGetTechnical(ticker, market) {
  try {
    const history = await yf.historical(toYFTicker(ticker, market), {
      period1:  new Date(Date.now() - 180 * 86400_000),
      period2:  new Date(),
      interval: '1d',
    })
    const sorted = history
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({ ...d, close: d.close ?? d.adjClose }))
    return computeIndicators(sorted)
  } catch (e) {
    return { error: `기술 지표 조회 실패: ${e.message}` }
  }
}

async function runGetNews(ticker, market) {
  const isKorean = market === 'KRX' || market === 'KOSDAQ'
  const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')

  // 한국 종목 — 네이버 금융 직접 호출
  if (isKorean) {
    // 네이버 뉴스 통합 API (JS 번들 역공학으로 확인된 실제 엔드포인트)
    try {
      const url = `https://m.stock.naver.com/api/news/integration/${cleanTicker}`
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Referer':    'https://m.stock.naver.com',
          'Accept':     'application/json, text/plain, */*',
        },
      })
      console.log(`[News] Naver ${resp.status} — ${url}`)
      if (resp.ok) {
        const data = await resp.json()
        // 응답 구조: { stockNews: [{ total, items: [{title, officeName, datetime, ...}] }] }
        const allItems = (data?.stockNews || []).flatMap(group => group.items || [])
        const news = allItems.slice(0, 5).map(n => ({
          title:     n.title || '',
          publisher: n.officeName || '',
          // datetime 형식: "202604201732" (YYYYMMDDHHmm) → "2026-04-20"
          date: n.datetime?.length >= 8
            ? `${n.datetime.slice(0,4)}-${n.datetime.slice(4,6)}-${n.datetime.slice(6,8)}`
            : null,
        })).filter(n => n.title)
        if (news.length > 0) {
          console.log(`[News] Naver OK — ${news.length}건`)
          return { news }
        }
      }
    } catch (e) {
      console.warn('[News] Naver 실패:', e.message)
    }

    // 네이버 전체 실패 시 — Yahoo REST API로 회사명 검색
    try {
      const q = await yf.quote(toYFTicker(cleanTicker, market))
      // longName 우선 사용 (shortName은 너무 잘림 — e.g. "SamsungElec")
      // "Samsung Electronics Co., Ltd." → "Samsung Electronics"
      const longName = q.longName || q.shortName || ''
      const searchName = longName
        .replace(/\s+(Co\.,?\s*Ltd\.?|Inc\.?|Corp\.?|plc\.?)$/i, '')
        .trim()

      if (searchName) {
        console.log(`[News] Yahoo REST 검색: "${searchName}"`)
        // yf.search 대신 Yahoo Finance REST API 직접 호출 (더 정확한 결과)
        const yfResp = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchName)}&newsCount=5&quotesCount=0&listsCount=0`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        const yfData = await yfResp.json()
        const news = (yfData?.news || []).slice(0, 5).map(n => ({
          title:     n.title,
          publisher: n.publisher,
          date:      n.providerPublishTime
            ? new Date(n.providerPublishTime * 1000).toISOString().slice(0, 10)
            : null,
        })).filter(n => n.title)
        if (news.length > 0) {
          console.log(`[News] Yahoo REST OK — ${news.length}건`)
          return { news }
        }
      }
    } catch (e) {
      console.warn('[News] Yahoo REST 실패:', e.message)
    }
  }

  // 미국 종목 또는 최종 폴백 — Yahoo Finance 티커 검색
  try {
    const result = await yf.search(toYFTicker(ticker, market), { newsCount: 5 })
    const news = (result.news || []).slice(0, 5).map(n => ({
      title:     n.title,
      publisher: n.publisher,
      date:      n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString().slice(0, 10)
        : null,
    }))
    return { news }
  } catch (e) {
    return { news: [], error: e.message }
  }
}

async function runGetDisclosures(ticker, market, days = 30, dartApiKey) {
  const isKorean    = market === 'KRX' || market === 'KOSDAQ'
  const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')

  if (isKorean) {
    if (!dartApiKey) return { disclosures: [] }
    try {
      const map      = await getCorpMap(dartApiKey)  // 캐시 공유
      const corpCode = map.get(cleanTicker)
      if (!corpCode) return { disclosures: [] }

      const toD = d => d.toISOString().slice(0, 10).replace(/-/g, '')
      const bgn = toD(new Date(Date.now() - days * 86400_000))
      const end = toD(new Date())

      const resp = await fetch(
        `https://opendart.fss.or.kr/api/list.json?crtfc_key=${dartApiKey}&corp_code=${corpCode}&bgn_de=${bgn}&end_de=${end}&page_count=10`,
        { headers: { 'User-Agent': 'MyPortfolioHub/1.0' } }
      )
      const data = await resp.json()
      if (data.status !== '000') return { disclosures: [] }

      const disclosures = (data.list || []).slice(0, 10).map(d => ({
        date:  `${d.rcept_dt.slice(0, 4)}-${d.rcept_dt.slice(4, 6)}-${d.rcept_dt.slice(6, 8)}`,
        title: d.report_nm,
        url:   `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      }))
      return { disclosures }
    } catch (e) {
      return { disclosures: [], error: e.message }
    }
  }

  // EDGAR
  try {
    const cikMap = await getCikMap()  // 캐시 공유
    const cik    = cikMap.get(ticker.toUpperCase())
    if (!cik) return { disclosures: [] }

    const resp = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': EDGAR_UA },
    })
    if (!resp.ok) return { disclosures: [] }

    const data   = await resp.json()
    const recent = data.filings?.recent
    if (!recent?.filingDate?.length) return { disclosures: [] }

    const cutoff  = Date.now() - days * 86400_000
    const cikInt  = parseInt(cik, 10)
    const disclosures = []

    for (let i = 0; i < Math.min(recent.filingDate.length, 100) && disclosures.length < 10; i++) {
      const form = recent.form[i]
      if (!EDGAR_FORMS.has(form)) continue
      if (new Date(recent.filingDate[i]).getTime() < cutoff) break
      const accNoDash  = recent.accessionNumber[i].replace(/-/g, '')
      const primaryDoc = recent.primaryDocument?.[i] || `${accNoDash}.txt`
      disclosures.push({
        date:  recent.filingDate[i],
        title: `${form}: ${recent.primaryDocDescription?.[i] || primaryDoc}`,
        url:   `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDash}/${primaryDoc}`,
      })
    }
    return { disclosures }
  } catch (e) {
    return { disclosures: [], error: e.message }
  }
}

// ── 도구 디스패처 ────────────────────────────────────────────────────
async function executeTool(toolName, input, dartApiKey) {
  switch (toolName) {
    case 'get_quote':       return runGetQuote(input.ticker, input.market)
    case 'get_profile':     return runGetProfile(input.ticker, input.market)
    case 'get_technical':   return runGetTechnical(input.ticker, input.market)
    case 'get_news':        return runGetNews(input.ticker, input.market)
    case 'get_disclosures': return runGetDisclosures(input.ticker, input.market, input.days, dartApiKey)
    default:                return { error: `알 수 없는 도구: ${toolName}` }
  }
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────
/**
 * POST /api/claude/agentic
 * Tool Use 멀티라운드 루프로 Claude 응답 생성
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @param {string} anthropicApiKey
 * @param {string} dartApiKey
 */
export async function handleAgenticRequest(req, res, anthropicApiKey, dartApiKey) {
  // POST body 수집
  let body = ''
  await new Promise(resolve => {
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', resolve)
  })

  let parsed
  try { parsed = JSON.parse(body) } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid JSON' }))
  }

  if (!anthropicApiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'API 키 미설정' }))
  }

  const { systemPrompt, messages, maxTokens = 3072 } = parsed
  const conversationMessages = [...messages]
  let finalText = null

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system:     systemPrompt,
        tools:      RESEARCH_TOOLS,
        messages:   conversationMessages,
      }),
    })

    if (!claudeResp.ok) {
      const err = await claudeResp.text()
      res.writeHead(claudeResp.status, { 'Content-Type': 'application/json' })
      return res.end(err)
    }

    const claudeData    = await claudeResp.json()
    const content       = claudeData.content || []
    const toolUseBlocks = content.filter(b => b.type === 'tool_use')

    // 도구 호출 없음 → 최종 텍스트 응답
    if (toolUseBlocks.length === 0) {
      finalText = content.find(b => b.type === 'text')?.text || '응답을 받지 못했습니다.'
      break
    }

    console.log(`[Agentic] Round ${round + 1}: ${toolUseBlocks.map(b => b.name).join(', ')} 실행 중...`)

    // 어시스턴트 메시지 추가 (tool_use 포함)
    conversationMessages.push({ role: 'assistant', content })

    // 도구 병렬 실행
    const toolResults = await Promise.all(
      toolUseBlocks.map(async block => {
        const result = await executeTool(block.name, block.input, dartApiKey)
        return {
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        }
      })
    )

    // 도구 결과를 사용자 메시지로 추가
    conversationMessages.push({ role: 'user', content: toolResults })
  }

  if (!finalText) {
    finalText = '최대 라운드(5)에 도달했습니다. 현재까지 수집된 데이터로 분석을 제공할 수 없습니다.'
  }

  // 기존 /api/claude와 동일한 응답 형식
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    content:     [{ type: 'text', text: finalText }],
    stop_reason: 'end_turn',
  }))
}
