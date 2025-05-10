import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  AssetOracle,
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

    // Find and update the pool that uses this oracle
    // Since each pool has a dedicated oracle, we can look up by oracle address
    if (oracle.pool) {
      let pool = Pool.load(oracle.pool);
      if (pool) {
        pool.currentAssetPrice = event.params.price;
        pool.updatedAt = event.block.timestamp;
        pool.save();
      }
    }
  }
}

export function handleOHLCDataUpdated(event: OHLCDataUpdated): void {
  let verifiedOracle = Oracle.load(event.address);

  if (verifiedOracle) {
    verifiedOracle.updatedAt = event.block.timestamp;
    verifiedOracle.save();
  }
}

export function handleSplitDetected(event: SplitDetected): void {
  let oracleAddress = event.address;
  let oracle = Oracle.load(oracleAddress);

  if (oracle) {
    // Update oracle data
    oracle.assetPrice = event.params.newPrice;
    oracle.updatedAt = event.block.timestamp;
    oracle.save();

    // Find and update the pool that uses this oracle
    if (oracle.pool) {
      let pool = Pool.load(oracle.pool);
      if (pool) {
        pool.currentAssetPrice = event.params.newPrice;
        pool.updatedAt = event.block.timestamp;
        pool.save();
      }
    }
  }
}
