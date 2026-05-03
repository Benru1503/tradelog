import type { Trade, AssetType, Direction, TradeStatus, User } from "@prisma/client";

export type { Trade, AssetType, Direction, TradeStatus, User };

export type TradeWithUser = Trade & { user: Pick<User, "id" | "displayName" | "avatarUrl"> };

export type TradeFilters = {
  assetType?: AssetType;
  direction?: Direction;
  status?: TradeStatus;
  from?: Date;
  to?: Date;
};

export type TradeSort = {
  field: "entryDate" | "exitDate" | "asset" | "pnl" | "pnlPercent";
  dir: "asc" | "desc";
};

export type DashboardStats = {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  avgRR: number;
  bestTrade: number;
  worstTrade: number;
};
