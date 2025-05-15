import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  CycleStarted,
  Rebalanced,
  RebalanceInitiated,
  InterestAccrued,
  isPriceDeviationValidUpdated,
  PoolCycleManager,
} from "../generated/templates/PoolCycleManager/PoolCycleManager";
import { PoolLiquidityManager } from "../generated/templates/PoolLiquidityManager/PoolLiquidityManager";
import { DefaultPoolStrategy } from "../generated/templates/DefaultPoolStrategy/DefaultPoolStrategy";
import { Pool, CycleManagerPool, LPPosition } from "../generated/schema";

export function handleCycleStarted(event: CycleStarted): void {
  let cycleManagerAddress = event.address;
  let cycleIndex = event.params.cycleIndex;
  let timestamp = event.params.timestamp;

  let cycleManager = CycleManagerPool.load(cycleManagerAddress);
  if (cycleManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(cycleManager.pool);

  // Load the pool
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  // Update pool with new cycle
  pool.cycleIndex = cycleIndex;
  pool.lastCycleActionDateTime = timestamp;
  pool.cycleTotalDeposits = BigInt.fromI32(0);
  pool.cycleTotalRedemptions = BigInt.fromI32(0);
  pool.cycleTotalAddLiquidityAmount = BigInt.fromI32(0);
  pool.cycleTotalReduceLiquidityAmount = BigInt.fromI32(0);
  pool.rebalancedLPs = BigInt.fromI32(0);
  pool.cycleInterestAmount = BigInt.fromI32(0);
  pool.updatedAt = event.block.timestamp;

  // Fetch totalLPLiquidityCommited from the liquidity manager
  if (pool.poolLiquidityManager) {
    let liquidityManagerAddress = Address.fromBytes(pool.poolLiquidityManager);
    let liquidityManager = PoolLiquidityManager.bind(liquidityManagerAddress);
    let totalLiquidityCall = liquidityManager.try_totalLPLiquidityCommited();
    if (!totalLiquidityCall.reverted) {
      pool.totalLPLiquidityCommited = totalLiquidityCall.value;
    }
  }

  // Fetch interest rate and utilization from the strategy
  if (pool.poolStrategy) {
    let strategyAddress = Address.fromBytes(pool.poolStrategy);
    let strategy = DefaultPoolStrategy.bind(strategyAddress);

    let interestRateCall = strategy.try_calculatePoolInterestRate(poolAddress);
    if (!interestRateCall.reverted) {
      pool.poolInterestRate = interestRateCall.value;
    }

    let utilizationCall =
      strategy.try_calculatePoolUtilizationRatio(poolAddress);
    if (!utilizationCall.reverted) {
      pool.poolUtilizationRatio = utilizationCall.value;
    }
  }

  let cycleManagerContract = PoolCycleManager.bind(cycleManagerAddress);
  let prevRebalancePriceCall = cycleManagerContract.try_cycleRebalancePrice(
    cycleIndex.minus(BigInt.fromI32(1))
  );
  if (!prevRebalancePriceCall.reverted) {
    pool.prevRebalancePrice = prevRebalancePriceCall.value;
  }

  pool.save();
}

export function handleRebalanceInitiated(event: RebalanceInitiated): void {
  let cycleManagerAddress = event.address;
  let cycleIndex = event.params.cycleIndex;
  let cyclePriceHigh = event.params.cyclePriceHigh;
  let cyclePriceLow = event.params.cyclePriceLow;

  let cycleManager = CycleManagerPool.load(cycleManagerAddress);
  if (cycleManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(cycleManager.pool);

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  pool.cycleState = "POOL_REBALANCING_ONCHAIN";
  pool.cyclePriceHigh = cyclePriceHigh;
  pool.cyclePriceLow = cyclePriceLow;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

export function handleRebalanced(event: Rebalanced): void {
  let cycleManagerAddress = event.address;
  let lpAddress = event.params.lp;
  let rebalancePrice = event.params.rebalancePrice;
  let amount = event.params.amount;
  let isDeposit = event.params.isDeposit;
  let cycleIndex = event.params.cycleIndex;

  let cycleManager = CycleManagerPool.load(cycleManagerAddress);
  if (cycleManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(cycleManager.pool);

  let id = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(id);

  if (lpPosition != null) {
    lpPosition.lastRebalanceCycle = cycleIndex;
    lpPosition.lastRebalancePrice = rebalancePrice;
  }

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  // Increment rebalancedLPs
  pool.rebalancedLPs = pool.rebalancedLPs.plus(BigInt.fromI32(1));
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

export function handleInterestAccrued(event: InterestAccrued): void {
  let cycleManagerAddress = event.address;
  let interestAccrued = event.params.interestAccrued;
  let cumulativeInterest = event.params.cumulativeInterest;
  let timestamp = event.params.timestamp;

  let cycleManager = CycleManagerPool.load(cycleManagerAddress);
  if (cycleManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(cycleManager.pool);

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  pool.cycleInterestAmount = interestAccrued;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

export function handleIsPriceDeviationValidUpdated(
  event: isPriceDeviationValidUpdated
): void {
  // No specific action needed for this event
}
