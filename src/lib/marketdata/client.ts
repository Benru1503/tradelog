// Market-data router. Server-side only — never import this from a client
// component, since it relies on provider API keys living in process env.
//
// Stocks/forex are routed to Finnhub; crypto to CoinGecko. Both providers
// degrade to empty results when the network or API key is unavailable, so
// the UI always renders gracefully (`—` placeholders, never a crash).

import type { AssetType } from "@prisma/client";
import { finnhubProvider } from "./providers/finnhub";
import { coingeckoProvider } from "./providers/coingecko";

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  assetType: AssetType;
  // For STOCK: the listing exchange (often null on Finnhub free tier).
  // For CRYPTO: the CoinGecko coin id (e.g. "bitcoin"), used internally to
  //   resolve quotes. The autocomplete UI hides this for non-stock types.
  // For FOREX: Finnhub's fully-qualified quote symbol (e.g. "OANDA:EUR_USD").
  exchange: string | null;
  sector: string | null;
}

export interface Quote {
  price: number;
  changePct: number | null;
}

export interface MarketDataProvider {
  searchSymbols(
    query: string,
    assetType?: AssetType,
  ): Promise<SymbolSearchResult[]>;
  getQuote(
    providerSymbol: string,
    assetType: AssetType,
  ): Promise<Quote | null>;
}

const router: MarketDataProvider = {
  async searchSymbols(query, assetType) {
    if (assetType === "CRYPTO") return coingeckoProvider.searchSymbols(query);
    if (assetType === "STOCK" || assetType === "FOREX")
      return finnhubProvider.searchSymbols(query, assetType);
    const [stocks, crypto] = await Promise.all([
      finnhubProvider.searchSymbols(query).catch(() => []),
      coingeckoProvider.searchSymbols(query).catch(() => []),
    ]);
    return [...stocks, ...crypto].slice(0, 10);
  },
  async getQuote(providerSymbol, assetType) {
    if (assetType === "CRYPTO") return coingeckoProvider.getQuote(providerSymbol);
    return finnhubProvider.getQuote(providerSymbol);
  },
};

export function getMarketDataProvider(): MarketDataProvider {
  return router;
}
