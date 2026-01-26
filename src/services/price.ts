// price service for fetching SOL price from CoinGecko

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'

let cachedPrice: number | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 1 minute cache

export const getSOLPriceUSD = async (): Promise<number | null> => {
  // return cached price if still valid
  if (cachedPrice && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedPrice
  }

  try {
    const response = await fetch(COINGECKO_URL)
    const data = await response.json()
    cachedPrice = data.solana?.usd || null
    cacheTimestamp = Date.now()
    console.log('fetched SOL price:', cachedPrice)
    return cachedPrice
  } catch (error) {
    console.error('failed to fetch SOL price:', error)
    return cachedPrice // return stale cache if available
  }
}

export const formatUSD = (solAmount: number, solPrice: number | null): string => {
  if (!solPrice) return ''
  const usdValue = solAmount * solPrice
  return `~$${usdValue.toFixed(2)} USD`
}
