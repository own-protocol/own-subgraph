import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  CycleStarted,
  Rebalanced,
  RebalanceInitiated,
  InterestAccrued,
  isPriceDeviationValidUpdated,
} from "../generated/templates/PoolCycleManager/PoolCycleManager";
import { Pool, Cycle, LPPosition, LPRebalance } from "../generated/schema";

export function handleCycleStarted(event: CycleStarted): void {
  let poolAddress = event.address;
  let cycleIndex = event.params.cycleIndex;
  let timestamp = event.params.timestamp;

  // Update pool cycle index
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    // Close the previous cycle
    let prevCycleId =
      poolAddress.toHexString() + "-" + pool.cycleIndex.toString();
    let prevCycle = Cycle.load(prevCycleId);
    if (prevCycle != null) {
      prevCycle.endTime = timestamp;
      prevCycle.save();
    }

    // Update pool stats
    pool.cycleIndex = cycleIndex;
    pool.lastCycleActionDateTime = timestamp;
    pool.cycleTotalDeposits = BigInt.fromI32(0);
    pool.cycleTotalRedemptions = BigInt.fromI32(0);
    pool.cycleTotalAddLiquidityAmount = BigInt.fromI32(0);
    pool.cycleTotalReduceLiquidityAmount = BigInt.fromI32(0);
    pool.rebalancedLPs = BigInt.fromI32(0);
    pool.cycleInterestAmount = BigInt.fromI32(0);
    pool.updatedAt = event.block.timestamp;
    pool.save();

    // Create a new cycle entity
    let newCycleId = poolAddress.toHexString() + "-" + cycleIndex.toString();
    let newCycle = new Cycle(newCycleId);
    newCycle.pool = poolAddress;
    newCycle.cycleIndex = cycleIndex;
    newCycle.state = "POOL_ACTIVE"; // New cycle always starts active
    newCycle.startTime = timestamp;
    newCycle.totalDeposits = BigInt.fromI32(0);
    newCycle.totalRedemptions = BigInt.fromI32(0);
    newCycle.totalAddLiquidity = BigInt.fromI32(0);
    newCycle.totalReduceLiquidity = BigInt.fromI32(0);
    newCycle.lpCount = pool.lpCount;
    newCycle.rebalancedLPs = BigInt.fromI32(0);
    newCycle.save();
  }
}

export function handleRebalanceInitiated(event: RebalanceInitiated): void {
  let poolAddress = event.address;
  let cycleIndex = event.params.cycleIndex;
  let cyclePriceHigh = event.params.cyclePriceHigh;
  let cyclePriceLow = event.params.cyclePriceLow;

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleState = "POOL_REBALANCING_ONCHAIN";
    pool.cyclePriceHigh = cyclePriceHigh;
    pool.cyclePriceLow = cyclePriceLow;
    pool.updatedAt = event.block.timestamp;
    pool.save();

    // Update cycle entity
    let cycleId = poolAddress.toHexString() + "-" + cycleIndex.toString();
    let cycle = Cycle.load(cycleId);
    if (cycle != null) {
      cycle.state = "POOL_REBALANCING_ONCHAIN";
      cycle.priceHigh = cyclePriceHigh;
      cycle.priceLow = cyclePriceLow;
      cycle.save();
    }
  }
}

export function handleRebalanced(event: Rebalanced): void {
  let poolAddress = event.address;
  let lpAddress = event.params.lp;
  let rebalancePrice = event.params.rebalancePrice;
  let amount = event.params.amount;
  let isDeposit = event.params.isDeposit;
  let cycleIndex = event.params.cycleIndex;

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.rebalancedLPs = pool.rebalancedLPs.plus(BigInt.fromI32(1));
    pool.updatedAt = event.block.timestamp;
    pool.save();

    // Update cycle data
    let cycleId = poolAddress.toHexString() + "-" + cycleIndex.toString();
    let cycle = Cycle.load(cycleId);
    if (cycle != null) {
      cycle.rebalancedLPs = cycle.rebalancedLPs.plus(BigInt.fromI32(1));
      cycle.rebalancePrice = rebalancePrice; // Last rebalance price becomes the cycle price

      // If this cycle doesn't have all LPs yet (happens during rebalances)
      if (cycle.lpCount.isZero() && !pool.lpCount.isZero()) {
        cycle.lpCount = pool.lpCount;
      }

      cycle.save();
    }

    // Create LP rebalance record
    let lpPositionId =
      lpAddress.toHexString() + "-" + poolAddress.toHexString();
    let lpPosition = LPPosition.load(lpPositionId);
    if (lpPosition != null) {
      let rebalanceId = lpPositionId + "-" + cycleIndex.toString();
      let lpRebalance = new LPRebalance(rebalanceId);
      lpRebalance.lpPosition = lpPositionId;
      lpRebalance.cycleIndex = cycleIndex;
      lpRebalance.rebalancePrice = rebalancePrice;
      lpRebalance.amount = amount;
      lpRebalance.isDeposit = isDeposit;
      lpRebalance.timestamp = event.block.timestamp;
      lpRebalance.wasSettled = false; // Regular rebalance
      lpRebalance.save();
    }
  }
}

export function handleInterestAccrued(event: InterestAccrued): void {
  let poolAddress = event.address;
  let interestAccrued = event.params.interestAccrued;
  let cumulativeInterest = event.params.cumulativeInterest;
  let timestamp = event.params.timestamp;

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleInterestAmount = pool.cycleInterestAmount.plus(interestAccrued);
    pool.updatedAt = event.block.timestamp;
    pool.save();

    // Update current cycle
    let cycleId = poolAddress.toHexString() + "-" + pool.cycleIndex.toString();
    let cycle = Cycle.load(cycleId);
    if (cycle != null) {
      cycle.cyclePoolInterest = cumulativeInterest;
      cycle.save();
    }
  }
}

export function handleIsPriceDeviationValidUpdated(
  event: isPriceDeviationValidUpdated
): void {
  // No specific action needed, this is primarily for UI/UX indicators
}
