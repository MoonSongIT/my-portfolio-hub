// Yahoo Finance 2 quoteSummary 프록시 — yahoo-finance2 npm 패키지 사용
import { setCors, handlePreflight } from '../_cors.js'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const { ticker } = req.query
  if (!ticker) {
    return res.status(400).json({ error: 'ticker 파라미터 필요' })
  }

  try {
    const result = await yf.quoteSummary(ticker, {
      modules: ['summaryProfile', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'],
    })
    res.status(200).json(result)
  } catch (err) {
    res.status(200).json({ _error: err.message })
  }
}
