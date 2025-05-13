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
} from "../generated/templates/PoolLiquidityManager/PoolLiquidityManager";
import {
  Pool,
  LPPosition,
  LPRequest,
  FeeEvent,
  ProtocolEvent,
  Cycle,
} from "../generated/schema";
import { PoolLiquidityManager } from "../generated/templates/PoolLiquidityManager/PoolLiquidityManager";

// Helper to create or update LP position
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
    lpPosition.liquidityCommitment = BigInt.fromI32(0);
    lpPosition.collateralAmount = BigInt.fromI32(0);
    lpPosition.interestAccrued = BigInt.fromI32(0);
    lpPosition.liquidityHealth = 3; // Start as healthy
    lpPosition.assetHoldingValue = BigInt.fromI32(0);
    lpPosition.liquidityShare = BigInt.fromI32(0);
    lpPosition.assetShare = BigInt.fromI32(0);
    lpPosition.createdAt = timestamp;
    lpPosition.updatedAt = timestamp;
  }

  return lpPosition;
}

// Helper to create LP request
function createLPRequest(
  lpAddress: Address,
  poolAddress: Address,
  requestType: string,
  requestAmount: BigInt,
  requestCycle: BigInt,
  timestamp: BigInt,
  liquidator: Address | null = null
): void {
  // Get LP position
  let positionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(positionId);

  if (lpPosition != null) {
    let requestId = positionId + "-" + requestCycle.toString();
    let lpRequest = new LPRequest(requestId);
    lpRequest.lpPosition = positionId;
    lpRequest.requestType = requestType;
    lpRequest.requestAmount = requestAmount;
    lpRequest.requestCycle = requestCycle;
    lpRequest.createdAt = timestamp;
    lpRequest.updatedAt = timestamp;
    lpRequest.status = "PENDING";

    if (liquidator) {
      lpRequest.liquidator = liquidator;
    }

    lpRequest.save();
  }
}

// Helper to update LP health
function updateLPHealth(lpAddress: Address, poolAddress: Address): void {
  let positionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(positionId);

  if (lpPosition == null) return;

  let liquManager = PoolLiquidityManager.bind(poolAddress);

  // Get LP analytics data
  let assetHoldingValueCall = liquManager.try_getLPAssetHoldingValue(lpAddress);
  let liquidityShareCall = liquManager.try_getLPLiquidityShare(lpAddress);
  let assetShareCall = liquManager.try_getLPAssetShare(lpAddress);

  if (!assetHoldingValueCall.reverted) {
    lpPosition.assetHoldingValue = assetHoldingValueCall.value;
  }

  if (!liquidityShareCall.reverted) {
    lpPosition.liquidityShare = liquidityShareCall.value;
  }

  if (!assetShareCall.reverted) {
    lpPosition.assetShare = assetShareCall.value;
  }

  // We would call the strategy contract to get the health, but for simplicity
  // let's approximate it based on the collateral ratio
  if (lpPosition.assetHoldingValue.isZero()) {
    lpPosition.liquidityHealth = 3; // Healthy if no asset value
  } else {
    // Calculate collateral ratio and set health
    // This is a simplified approximation - in real implementation, call the strategy contract
    let collateralRatio = lpPosition.collateralAmount
      .times(BigInt.fromI32(10000))
      .div(lpPosition.assetHoldingValue);

    if (collateralRatio.ge(BigInt.fromI32(3000))) {
      // 30%
      lpPosition.liquidityHealth = 3; // Healthy
    } else if (collateralRatio.ge(BigInt.fromI32(2000))) {
      // 20%
      lpPosition.liquidityHealth = 2; // Warning
    } else {
      lpPosition.liquidityHealth = 1; // Liquidatable
    }
  }

  lpPosition.updatedAt = BigInt.now();
  lpPosition.save();
}

// Helper to update pool LP stats
function updatePoolLPStats(poolAddress: Address): void {
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  let liquManager = PoolLiquidityManager.bind(poolAddress);

  // Update pool LP stats
  let totalLPLiquidityCall = liquManager.try_totalLPLiquidityCommited();
  let totalLPCollateralCall = liquManager.try_totalLPCollateral();
  let lpCountCall = liquManager.try_lpCount();
  let cycleTotalAddLiquidityCall =
    liquManager.try_cycleTotalAddLiquidityAmount();
  let cycleTotalReduceLiquidityCall =
    liquManager.try_cycleTotalReduceLiquidityAmount();

  if (!totalLPLiquidityCall.reverted) {
    pool.totalLPLiquidityCommited = totalLPLiquidityCall.value;
  }

  if (!totalLPCollateralCall.reverted) {
    pool.totalLPCollateral = totalLPCollateralCall.value;
  }

  if (!lpCountCall.reverted) {
    pool.lpCount = lpCountCall.value;
  }

  if (!cycleTotalAddLiquidityCall.reverted) {
    pool.cycleTotalAddLiquidityAmount = cycleTotalAddLiquidityCall.value;
  }

  if (!cycleTotalReduceLiquidityCall.reverted) {
    pool.cycleTotalReduceLiquidityAmount = cycleTotalReduceLiquidityCall.value;
  }

  // Update current cycle if applicable
  let cycleId = poolAddress.toHexString() + "-" + pool.cycleIndex.toString();
  let cycle = Cycle.load(cycleId);
  if (cycle != null) {
    cycle.totalAddLiquidity = pool.cycleTotalAddLiquidityAmount;
    cycle.totalReduceLiquidity = pool.cycleTotalReduceLiquidityAmount;
    cycle.lpCount = pool.lpCount;
    cycle.save();
  }

  pool.updatedAt = BigInt.now();
  pool.save();
}

// Handle LP Collateral Events

export function handleCollateralAdded(event: CollateralAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_COLLATERAL_ADDED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleCollateralReduced(event: CollateralReduced): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_COLLATERAL_REDUCED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleInterestClaimed(event: InterestClaimed): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.interestAccrued = BigInt.fromI32(0); // Reset after claiming
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_INTEREST_CLAIMED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

// Handle LP Registration/Removal

export function handleLPAdded(event: LPAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let collateral = event.params.collateral;

  // Create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = amount;
  lpPosition.collateralAmount = collateral;
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_ADDED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLPRemoved(event: LPRemoved): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;

  // Get LP position
  let positionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();
  let lpPosition = LPPosition.load(positionId);

  if (lpPosition != null) {
    // We keep the entity but set values to zero
    lpPosition.liquidityCommitment = BigInt.fromI32(0);
    lpPosition.collateralAmount = BigInt.fromI32(0);
    lpPosition.interestAccrued = BigInt.fromI32(0);
    lpPosition.assetHoldingValue = BigInt.fromI32(0);
    lpPosition.liquidityShare = BigInt.fromI32(0);
    lpPosition.assetShare = BigInt.fromI32(0);
    lpPosition.updatedAt = event.block.timestamp;
    lpPosition.save();
  }

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_REMOVED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = BigInt.fromI32(0);
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

// Handle LP Liquidity Events

export function handleLiquidityAdded(event: LiquidityAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let prevCycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1));
    let requestId = lpPosition.id + "-" + prevCycleIndex.toString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "ADD_LIQUIDITY") {
      lpRequest.status = "COMPLETED";
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_ADDED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLiquidityReduced(event: LiquidityReduced): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let prevCycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1));
    let requestId = lpPosition.id + "-" + prevCycleIndex.toString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "REDUCE_LIQUIDITY") {
      lpRequest.status = "COMPLETED";
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_REDUCED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

// Handle LP Requests

export function handleLiquidityAdditionRequested(
  event: LiquidityAdditionRequested
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycle;

  // Create LP request
  createLPRequest(
    lpAddress,
    poolAddress,
    "ADD_LIQUIDITY",
    amount,
    cycle,
    event.block.timestamp
  );

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_ADDITION_REQUESTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLiquidityReductionRequested(
  event: LiquidityReductionRequested
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycle;

  // Create LP request
  createLPRequest(
    lpAddress,
    poolAddress,
    "REDUCE_LIQUIDITY",
    amount,
    cycle,
    event.block.timestamp
  );

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_REDUCTION_REQUESTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

// Handle LP Liquidation Events

export function handleLPLiquidationRequested(
  event: LPLiquidationRequested
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let cycle = event.params.cycle;
  let amount = event.params.amount;

  // We need to determine the liquidator from a separate mapping call
  // For simplicity, we'll leave liquidator null here

  // Create LP request
  createLPRequest(
    lpAddress,
    poolAddress,
    "LIQUIDATE",
    amount,
    cycle,
    event.block.timestamp
  );

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDATION_REQUESTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLPLiquidationExecuted(
  event: LPLiquidationExecuted
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;
  let reward = event.params.reward;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Update LP health
  updateLPHealth(lpAddress, poolAddress);

  // Update pool stats
  updatePoolLPStats(poolAddress);

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let prevCycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1));
    let requestId = lpPosition.id + "-" + prevCycleIndex.toString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "LIQUIDATE") {
      lpRequest.status = "COMPLETED";
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDATION_EXECUTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLiquidationCancelled(event: LiquidationCancelled): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let cycleIndex = pool.cycleIndex; // Cancellation happens in the same cycle
    let requestId =
      lpAddress.toHexString() +
      "-" +
      poolAddress.toHexString() +
      "-" +
      cycleIndex.toString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "LIQUIDATE") {
      lpRequest.status = "CANCELLED";
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDATION_CANCELLED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = BigInt.fromI32(0);
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

// Handle Interest and Rebalance Amount Events

export function handleInterestDistributedToLP(
  event: InterestDistributedToLP
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycleIndex = event.params.cycleIndex;

  // Update LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.interestAccrued = lpPosition.interestAccrued.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_INTEREST_DISTRIBUTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleRebalanceAmountTransferred(
  event: RebalanceAmountTransferred
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycleIndex = event.params.cycleIndex;

  // Create protocol event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(id);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_REBALANCE_AMOUNT_TRANSFERRED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleFeeDeducted(event: FeeDeducted): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Create fee event
  let id =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let feeEvent = new FeeEvent(id);
  feeEvent.pool = poolAddress;
  feeEvent.user = userAddress;
  feeEvent.amount = amount;
  feeEvent.timestamp = event.block.timestamp;
  feeEvent.transactionHash = event.transaction.hash;
  feeEvent.blockNumber = event.block.number;
  feeEvent.save();
}
