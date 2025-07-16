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
  pool.cycleState = "POOL_ACTIVE";
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
  let cycleState = event.params.cycleState;

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

  // Map the numeric state to a string
  pool.cycleState =
    cycleState == 0
      ? "POOL_ACTIVE"
      : cycleState == 1
        ? "POOL_REBALANCING_OFFCHAIN"
        : cycleState == 2
          ? "POOL_REBALANCING_ONCHAIN"
          : "POOL_HALTED";

  // If state is POOL_REBALANCING_ONCHAIN, fetch high/low prices
  if (cycleState == 2) {
    let contract = PoolCycleManager.bind(cycleManagerAddress);
    let highCall = contract.try_cyclePriceHigh();
    let lowCall = contract.try_cyclePriceLow();

    if (!highCall.reverted) {
      pool.cyclePriceHigh = highCall.value;
    }

    if (!lowCall.reverted) {
      pool.cyclePriceLow = lowCall.value;
    }
  }

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

  // Load LP position
  let id = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(id);
  let pool = Pool.load(poolAddress);

  if (pool == null) {
    return; // Pool doesn't exist, exit early
  }

  // Only proceed if LP position exists
  if (lpPosition != null) {
    // Update rebalance-related info here
    lpPosition.lastRebalanceCycle = cycleIndex;
    lpPosition.lastRebalancePrice = rebalancePrice;

    // Fetch LP Health using strategy contract
    let strategyAddress = Address.fromBytes(pool.poolStrategy);
    let liquidityManagerAddress = Address.fromBytes(pool.poolLiquidityManager);
    let strategyContract = DefaultPoolStrategy.bind(strategyAddress);

    let lpHealthResult = strategyContract.try_getLPLiquidityHealth(
      liquidityManagerAddress,
      lpAddress
    );

    if (!lpHealthResult.reverted) {
      lpPosition.liquidityHealth = lpHealthResult.value;
    }

    // Determine LP active status based on current liquidity
    if (lpPosition.liquidityCommitment.gt(BigInt.zero())) {
      lpPosition.isLPActive = true;
    } else {
      lpPosition.isLPActive = false;
    }

    lpPosition.updatedAt = event.block.timestamp;
    lpPosition.save();
  }

  // Update pool rebalanced count | Increment rebalancedLPs
  pool.rebalancedLPs = pool.rebalancedLPs.plus(BigInt.fromI32(1));
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

export function handleInterestAccrued(event: InterestAccrued): void {
  let cycleManagerAddress = event.address;
  let interestAccrued = event.params.interestAccrued;
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

  // Todo: this needs to be updated to handle interest accrued correctly
  pool.cycleInterestAmount = interestAccrued;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

export function handleIsPriceDeviationValidUpdated(
  event: isPriceDeviationValidUpdated
): void {
  // No specific action needed for this event
}
