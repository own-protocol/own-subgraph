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
  ProtocolEvent,
  LPRequest,
  FeeEvent,
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
    lpPosition.liquidityCommitment = BigInt.fromI32(0);
    lpPosition.collateralAmount = BigInt.fromI32(0);
    lpPosition.interestAccrued = BigInt.fromI32(0);
    lpPosition.liquidityHealth = 3; // Healthy
    lpPosition.assetHoldingValue = BigInt.fromI32(0);
    lpPosition.liquidityShare = BigInt.fromI32(0);
    lpPosition.assetShare = BigInt.fromI32(0);
    lpPosition.createdAt = timestamp;
    lpPosition.updatedAt = timestamp;
  }

  return lpPosition;
}

export function handleCollateralAdded(event: CollateralAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.collateralAmount = lpPosition.collateralAmount.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.interestAccrued = BigInt.fromI32(0); // Reset after claiming
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_INTEREST_CLAIMED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLPAdded(event: LPAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let collateral = event.params.collateral;

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = amount;
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

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Update pool LP count
  let pool = Pool.load(poolAddress);
  if (pool != null && pool.lpCount.gt(BigInt.fromI32(0))) {
    pool.lpCount = pool.lpCount.minus(BigInt.fromI32(1));
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_REMOVED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = BigInt.fromI32(0);
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLiquidityAdded(event: LiquidityAdded): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.plus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Get or create LP position
  let lpPosition = getOrCreateLPPosition(
    lpAddress,
    poolAddress,
    event.block.timestamp
  );
  lpPosition.liquidityCommitment = lpPosition.liquidityCommitment.minus(amount);
  lpPosition.updatedAt = event.block.timestamp;
  lpPosition.save();

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_REDUCED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLiquidityAdditionRequested(
  event: LiquidityAdditionRequested
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycle;

  // Create LP request
  let requestId =
    lpAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycle.toString();

  let lpPositionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.lpPosition = lpPositionId;
  lpRequest.requestType = "ADD_LIQUIDITY";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.status = "PENDING";
  lpRequest.save();

  // Update pool stats using a safer approach
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalAddLiquidityAmount =
      pool.cycleTotalAddLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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
  let requestId =
    lpAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycle.toString();

  let lpPositionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.lpPosition = lpPositionId;
  lpRequest.requestType = "REDUCE_LIQUIDITY";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.status = "PENDING";
  lpRequest.save();

  // Update pool stats
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalReduceLiquidityAmount =
      pool.cycleTotalReduceLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDITY_REDUCTION_REQUESTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}

export function handleLPLiquidationRequested(
  event: LPLiquidationRequested
): void {
  let lpAddress = event.params.lp;
  let poolAddress = event.address;
  let cycle = event.params.cycle;
  let amount = event.params.amount;

  // Create LP request
  let requestId =
    lpAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycle.toString();

  let lpPositionId = lpAddress.toHexString() + "-" + poolAddress.toHexString();

  let lpRequest = new LPRequest(requestId);
  lpRequest.lpPosition = lpPositionId;
  lpRequest.requestType = "LIQUIDATE";
  lpRequest.requestAmount = amount;
  lpRequest.requestCycle = cycle;
  lpRequest.createdAt = event.block.timestamp;
  lpRequest.updatedAt = event.block.timestamp;
  lpRequest.status = "PENDING";
  lpRequest.save();

  // Update pool stats
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    pool.cycleTotalReduceLiquidityAmount =
      pool.cycleTotalReduceLiquidityAmount.plus(amount);
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Find and update request status
  let pool = Pool.load(poolAddress);
  if (pool != null) {
    let prevCycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1));
    let requestId =
      lpAddress.toHexString() +
      "-" +
      poolAddress.toHexString() +
      "-" +
      prevCycleIndex.toString();
    let lpRequest = LPRequest.load(requestId);

    if (lpRequest != null && lpRequest.requestType == "LIQUIDATE") {
      lpRequest.status = "COMPLETED";
      lpRequest.updatedAt = event.block.timestamp;
      lpRequest.save();
    }
  }

  // Create protocol event
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_LIQUIDATION_CANCELLED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = BigInt.fromI32(0);
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
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
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

  // Create fee event - make sure to import FeeEvent if not already imported
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
  let eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let protocolEvent = new ProtocolEvent(eventId);
  protocolEvent.pool = poolAddress;
  protocolEvent.eventType = "LP_INTEREST_DISTRIBUTED";
  protocolEvent.user = lpAddress;
  protocolEvent.amount = amount;
  protocolEvent.timestamp = event.block.timestamp;
  protocolEvent.transactionHash = event.transaction.hash;
  protocolEvent.blockNumber = event.block.number;
  protocolEvent.save();
}
