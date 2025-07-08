import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  CollateralAdded,
  CollateralReduced,
  InterestClaimed,
  LPAdded,
  LPLiquidationExecuted,
  LPLiquidationRequested,
  LPRemoved,
  LiquidationCancelled,
  LiquidityAdded,
  LiquidityAdditionRequested,
  LiquidityReduced,
  LiquidityReductionRequested,
  InterestDistributedToLP,
  RebalanceAmountTransferred,
  FeeDeducted,
  DelegateSet,
} from "../generated/templates/PoolLiquidityManager/PoolLiquidityManager";
import {
  Pool,
  LPPosition,
  LPRequest,
  FeeEvent,
  LiquidityManagerPool,
} from "../generated/schema";

// Helper function to get or create LP position
function getOrCreateLPPosition(
  lpAddress: Address,
  poolAddress: Address,
  timestamp: BigInt
): LPPosition {
  let id = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(id);

  if (lpPosition == null) {
    lpPosition = new LPPosition(id);
    lpPosition.lp = lpAddress;
    lpPosition.pool = poolAddress;
    lpPosition.delegateAddress = Address.fromString(
      "0x0000000000000000000000000000000000000000"
    ); // Default to zero address
    lpPosition.liquidityCommitment = BigInt.fromI32(0);
    lpPosition.collateralAmount = BigInt.fromI32(0);
    lpPosition.interestAccrued = BigInt.fromI32(0);
    lpPosition.liquidityHealth = 3; // Healthy
    lpPosition.assetShare = BigInt.fromI32(0);
    lpPosition.lastRebalanceCycle = BigInt.fromI32(0);
    lpPosition.lastRebalancePrice = BigInt.fromI32(0);
    lpPosition.createdAt = timestamp;
    lpPosition.updatedAt = timestamp;
  }

  return lpPosition;
}

export function handleCollateralAdded(event: CollateralAdded): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}

export function handleCollateralReduced(event: CollateralReduced): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}

export function handleInterestClaimed(event: InterestClaimed): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.interestAccrued = BigInt.fromI32(0); // Reset after claiming
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}

export function handleDelegateSet(event: DelegateSet): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let delegateAddress = event.params.delegate;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.delegateAddress = delegateAddress;
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}

export function handleLPAdded(event: LPAdded): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let collateral = event.params.collateral;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = collateral;
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update pool LP count
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.lpCount = pool.lpCount.plus(BigInt.fromI32(1));
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleLPRemoved(event: LPRemoved): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Get LP position
  let positionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(positionId);

  if (lpPosition != null) {
    // We keep the entity but set values to zero
    lpPosition.liquidityCommitment = BigInt.fromI32(0);
    lpPosition.collateralAmount = BigInt.fromI32(0);
    lpPosition.interestAccrued = BigInt.fromI32(0);
    lpPosition.assetShare = BigInt.fromI32(0);
    lpPosition.updatedAt = event.block.timestamp;
    lpPosition.save();
  }

  // Update pool LP count
  let pool = Pool.load(poolAddress);
  if (pool != null && pool.lpCount.gt(BigInt.fromI32(0))) {
    pool.lpCount = pool.lpCount.minus(BigInt.fromI32(1));
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleLiquidityAdded(event: LiquidityAdded): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  let id = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpRequest = LPRequest.load(id);

  if (lpRequest != null) {
    // Update request status
    lpRequest.requestType = "NONE";
    lpRequest.requestAmount = BigInt.fromI32(0);
    lpRequest.updatedAt = event.block.timestamp;
    lpRequest.save();
  }

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}

export function handleLiquidityReduced(event: LiquidityReduced): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  let id = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpRequest = LPRequest.load(id);

  if (lpRequest != null) {
    // Update request status
    lpRequest.requestType = "NONE";
    lpRequest.requestAmount = BigInt.fromI32(0);
    lpRequest.updatedAt = event.block.timestamp;
    lpRequest.save();
  }

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  if (lpPosition.liquidityCommitment.ge(amount)) {
    lpPosition.liquidityCommitment =
      lpPosition.liquidityCommitment.minus(amount);
    lpPosition.updatedAt = event.block.timestamp;
    lpPosition.save();
  }
}

export function handleLiquidityAdditionRequested(
  event: LiquidityAdditionRequested
): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycle;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Create LP request
  let requestId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.requestType = "ADD_LIQUIDITY";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.save();

  // Update pool stats using a safer approach
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalAddLiquidityAmount =
      pool.cycleTotalAddLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleLiquidityReductionRequested(
  event: LiquidityReductionRequested
): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycle;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Create LP request
  let requestId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.requestType = "REDUCE_LIQUIDITY";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.save();

  // Update pool stats
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalReduceLiquidityAmount =
      pool.cycleTotalReduceLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleLPLiquidationRequested(
  event: LPLiquidationRequested
): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let cycle = event.params.cycle;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Create LP request
  let requestId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.requestType = "LIQUIDATE";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.save();

  // Update pool stats
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalReduceLiquidityAmount =
      pool.cycleTotalReduceLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleLPLiquidationExecuted(
  event: LPLiquidationExecuted
): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;
  let reward = event.params.reward;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let requestId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "LIQUIDATE") {
      lpRequest.requestType = "NONE";
      lpRequest.requestAmount = BigInt.fromI32(0);
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }
}

export function handleLiquidationCancelled(event: LiquidationCancelled): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let requestId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "LIQUIDATE") {
      lpRequest.requestType = "NONE";
      lpRequest.requestAmount = BigInt.fromI32(0);
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }
}

export function handleRebalanceAmountTransferred(
  event: RebalanceAmountTransferred
): void {
  return; // No action needed for this event
}

export function handleFeeDeducted(event: FeeDeducted): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Create fee event - make sure to import FeeEvent if not already imported
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let feeEvent = new FeeEvent(id);
  feeEvent.pool = poolAddress;
  feeEvent.user = lpAddress;
  feeEvent.amount = amount;
  feeEvent.timestamp = event.block.timestamp;
  feeEvent.transactionHash = event.transaction.hash;
  feeEvent.blockNumber = event.block.number;
  feeEvent.save();
}

export function handleInterestDistributedToLP(
  event: InterestDistributedToLP
): void {
  let lpAddress = event.params.lp;
  let liquidityManagerAddress = event.address;
  let amount = event.params.amount;
  let cycleIndex = event.params.cycleIndex;

  let liquidityManager = LiquidityManagerPool.load(liquidityManagerAddress);
  if (liquidityManager == null) {
    return; // Mapping doesn't exist, exit early
  }

  let poolAddress = Address.fromBytes(liquidityManager.pool);

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.interestAccrued = lpPosition.interestAccrued.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();
}
