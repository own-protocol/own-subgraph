import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  AssetPriceUpdated,
  OHLCDataUpdated,
  SplitDetected,
} from "../generated/templates/AssetOracle/AssetOracle";
import { Oracle, Pool } from "../generated/schema";

export function handleAssetPriceUpdated(event: AssetPriceUpdated): void {
  let oracleAddress = event.address;
  let oracle = Oracle.load(oracleAddress);

  if (oracle) {
    // Update oracle data
    oracle.assetPrice = event.params.price;
    oracle.lastUpdated = event.params.timestamp;
    oracle.updatedAt = event.block.timestamp;

    oracle.save();
  }
}

export function handleOHLCDataUpdated(event: OHLCDataUpdated): void {
  let oracleAddress = event.address;
  let oracle = Oracle.load(oracleAddress);

  if (oracle) {
    // Update OHLC data
    oracle.ohlcOpen = event.params.open;
    oracle.ohlcHigh = event.params.high;
    oracle.ohlcLow = event.params.low;
    oracle.ohlcClose = event.params.close;
    oracle.ohlcTimestamp = event.params.timestamp;
    oracle.updatedAt = event.block.timestamp;
    oracle.save();
  }
}

export function handleSplitDetected(event: SplitDetected): void {
  let oracleAddress = event.address;
  let oracle = Oracle.load(oracleAddress);

  if (oracle) {
    // Update split detection data
    oracle.splitDetected = true;
    oracle.preSplitPrice = event.params.prevPrice;
    oracle.lastUpdated = event.params.timestamp;
    oracle.updatedAt = event.block.timestamp;
    oracle.save();
  }
}
