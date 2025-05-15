import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  CycleStarted,
  Rebalanced,
  RebalanceInitiated,
  InterestAccrued,
  isPriceDeviationValidUpdated,
} from "../generated/templates/PoolCycleManager/PoolCycleManager";
import { PoolLiquidityManager } from "../generated/templates/PoolLiquidityManager/PoolLiquidityManager";
import { DefaultPoolStrategy } from "../generated/templates/DefaultPoolStrategy/DefaultPoolStrategy";
import {
  Pool,
  Cycle,
  LPPosition,
  LPRebalance,
  CycleManagerPool,
} from "../generated/schema";

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

  let prevCycleId =
    poolAddress.toHexString() + "-" + pool.cycleIndex.toString();
  let prevCycle = Cycle.load(prevCycleId);
  if (prevCycle != null) {
    prevCycle.endTime = timestamp;
    prevCycle.save();
  }

  // Create a new cycle entity
  let newCycleId = poolAddress.toHexString() + "-" + cycleIndex.toString();
  let newCycle = new Cycle(newCycleId);
  newCycle.pool = poolAddress;
  newCycle.cycleIndex = cycleIndex;
  newCycle.state = "POOL_ACTIVE";
  newCycle.startTime = timestamp;
  newCycle.totalDeposits = BigInt.fromI32(0);
  newCycle.totalRedemptions = BigInt.fromI32(0);
  newCycle.totalAddLiquidity = BigInt.fromI32(0);
  newCycle.totalReduceLiquidity = BigInt.fromI32(0);
  newCycle.lpCount = BigInt.fromI32(0);
  newCycle.rebalancedLPs = BigInt.fromI32(0);
  newCycle.save();

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

  // Update pool data
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  // Increment rebalancedLPs
  pool.rebalancedLPs = pool.rebalancedLPs.plus(BigInt.fromI32(1));
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Update cycle data
  let cycleId = poolAddress.toHexString() + "-" + cycleIndex.toString();
  let cycle = Cycle.load(cycleId);
  if (cycle != null) {
    // Initialize rebalancedLPs if not set
    if (!cycle.rebalancedLPs) {
      cycle.rebalancedLPs = BigInt.fromI32(0);
    }

    cycle.rebalancedLPs = cycle.rebalancedLPs.plus(BigInt.fromI32(1));
    cycle.rebalancePrice = rebalancePrice;

    // If lpCount is null or zero but pool has LP count, use that
    if (!cycle.lpCount || cycle.lpCount.isZero()) {
      if (pool.lpCount) {
        cycle.lpCount = pool.lpCount;
      } else {
        cycle.lpCount = BigInt.fromI32(0);
      }
    }

    cycle.save();
  }

  // Create LP rebalance record
  let lpPositionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(lpPositionId);
  if (lpPosition != null) {
    let rebalanceId = lpPositionId + "-" + cycleIndex.toString();
    let lpRebalance = new LPRebalance(rebalanceId);
    lpRebalance.cycle = cycleId;
    lpRebalance.lpPosition = lpPositionId;
    lpRebalance.cycleIndex = cycleIndex;
    lpRebalance.rebalancePrice = rebalancePrice;
    lpRebalance.amount = amount;
    lpRebalance.isDeposit = isDeposit;
    lpRebalance.timestamp = event.block.timestamp;
    lpRebalance.wasSettled = false;
    lpRebalance.save();
  }
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

  // If we have a valid cycle index, update the current cycle
  if (pool.cycleIndex) {
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
  // No specific action needed for this event
}
