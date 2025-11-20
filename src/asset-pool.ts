import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  AssetPool,
  CollateralDeposited,
  CollateralWithdrawn,
  DepositRequested,
  AssetClaimed,
  RedemptionRequested,
  ReserveWithdrawn,
  LiquidationRequested,
  LiquidationClaimed,
  LiquidationCancelled,
  FeeDeducted,
} from "../generated/templates/AssetPool/AssetPool";
import { XToken } from "../generated/templates/XToken/XToken";
import { Pool, UserPosition, UserRequest, FeeEvent } from "../generated/schema";

// Helper to create or update user position
function getOrCreateUserPosition(
  userAddress: Address,
  poolAddress: Address,
  timestamp: BigInt
): UserPosition {
  let id = userAddress.toHexString() + "-" + poolAddress.toHexString();
  let userPosition = UserPosition.load(id);

  if (userPosition == null) {
    userPosition = new UserPosition(id);
    userPosition.user = userAddress;
    userPosition.pool = poolAddress;
    userPosition.assetAmount = BigInt.fromI32(0);
    userPosition.depositAmount = BigInt.fromI32(0);
    userPosition.collateralAmount = BigInt.fromI32(0);
    userPosition.createdAt = timestamp;
    userPosition.updatedAt = timestamp;
  }

  return userPosition;
}

// Helper to get or create user request
function getOrCreateUserRequest(
  userAddress: Address,
  poolAddress: Address,
  timestamp: BigInt
): UserRequest {
  let requestId = userAddress.toHexString() + "-" + poolAddress.toHexString();
  let userRequest = UserRequest.load(requestId);

  if (userRequest == null) {
    userRequest = new UserRequest(requestId);
    userRequest.requestType = "NONE";
    userRequest.amount = BigInt.fromI32(0);
    userRequest.collateralAmount = BigInt.fromI32(0);
    userRequest.requestCycle = BigInt.fromI32(0);
    userRequest.createdAt = timestamp;
    userRequest.updatedAt = timestamp;
  }

  return userRequest;
}

// Helper to update pool data
function updatePoolData(poolAddress: Address, timestamp: BigInt): void {
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  let assetPoolContract = AssetPool.bind(poolAddress);

  // Update all pool metrics
  let reserveBackingAssetCall = assetPoolContract.try_reserveBackingAsset();
  let aggregatePoolReservesCall = assetPoolContract.try_aggregatePoolReserves();
  let cycleTotalDepositsCall = assetPoolContract.try_cycleTotalDeposits();
  let cycleTotalRedemptionsCall = assetPoolContract.try_cycleTotalRedemptions();

  if (!reserveBackingAssetCall.reverted) {
    pool.reserveBackingAsset = reserveBackingAssetCall.value;
  }

  if (!aggregatePoolReservesCall.reverted) {
    pool.aggregatePoolReserves = aggregatePoolReservesCall.value;
  }

  if (!cycleTotalDepositsCall.reverted) {
    pool.cycleTotalDeposits = cycleTotalDepositsCall.value;
  }

  if (!cycleTotalRedemptionsCall.reverted) {
    pool.cycleTotalRedemptions = cycleTotalRedemptionsCall.value;
  }

  // Update asset supply
  if (pool.assetToken) {
    let assetToken = XToken.bind(Address.fromBytes(pool.assetToken));
    let totalSupplyCall = assetToken.try_totalSupply();
    if (!totalSupplyCall.reverted) {
      pool.assetSupply = totalSupplyCall.value;
    }
  }

  pool.updatedAt = timestamp;
  pool.save();
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userPosition.collateralAmount = userPosition.collateralAmount.plus(amount);
  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleCollateralWithdrawn(event: CollateralWithdrawn): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userPosition.collateralAmount = userPosition.collateralAmount.minus(amount);
  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleDepositRequested(event: DepositRequested): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycleIndex;

  // Get pool to determine collateral amount
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  // Create deposit request
  let assetPoolContract = AssetPool.bind(poolAddress);
  let userRequestsCall = assetPoolContract.try_userRequests(userAddress);
  let collateralAmount = BigInt.fromI32(0);

  if (!userRequestsCall.reverted) {
    collateralAmount = userRequestsCall.value.getCollateralAmount();
  }

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userRequest.requestType = "DEPOSIT";
  userRequest.amount = amount;
  userRequest.collateralAmount = collateralAmount;
  userRequest.requestCycle = cycle;
  userRequest.updatedAt = event.block.timestamp;
  userRequest.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleAssetClaimed(event: AssetClaimed): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycleIndex;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userPosition.assetAmount = userPosition.assetAmount.plus(amount);
  userPosition.depositAmount = userPosition.depositAmount.plus(
    userRequest.amount
  );
  userPosition.collateralAmount = userPosition.collateralAmount.plus(
    userRequest.collateralAmount
  );
  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update user request
  userRequest.requestType = "NONE"; // Reset request type
  userRequest.amount = BigInt.fromI32(0);
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for asset claim
  userRequest.requestCycle = BigInt.fromI32(0); // Reset cycle
  userRequest.updatedAt = event.block.timestamp;
  userRequest.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleRedemptionRequested(event: RedemptionRequested): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.assetAmount;
  let cycle = event.params.cycleIndex;

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userRequest.requestType = "REDEEM";
  userRequest.amount = amount;
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for redemption
  userRequest.requestCycle = cycle;
  userRequest.updatedAt = event.block.timestamp;
  userRequest.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleReserveWithdrawn(event: ReserveWithdrawn): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.amount;
  let cycle = event.params.cycleIndex;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  // Get asset pool contract to determine how much asset was redeemed
  let assetPoolContract = AssetPool.bind(poolAddress);
  let userPositionsCall = assetPoolContract.try_userPositions(userAddress);

  if (!userPositionsCall.reverted) {
    let assetAmount = userPositionsCall.value.getAssetAmount();
    let depositAmount = userPositionsCall.value.getDepositAmount();
    let collateralAmount = userPositionsCall.value.getCollateralAmount();
    userPosition.assetAmount = assetAmount;
    userPosition.depositAmount = depositAmount;
    userPosition.collateralAmount = collateralAmount;
    userPosition.updatedAt = event.block.timestamp;
    userPosition.save();
  }

  // Update user request
  userRequest.requestType = "NONE"; // Reset request type
  userRequest.amount = BigInt.fromI32(0);
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for reserve withdrawal
  userRequest.requestCycle = BigInt.fromI32(0); // Reset cycle
  userRequest.updatedAt = event.block.timestamp;
  userRequest.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleLiquidationRequested(event: LiquidationRequested): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;
  let cycle = event.params.cycleIndex;

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userRequest.requestType = "LIQUIDATE";
  userRequest.amount = amount;
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for liquidation
  userRequest.requestCycle = cycle;
  userRequest.updatedAt = event.block.timestamp;
  userRequest.liquidator = liquidator;
  userRequest.save();

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleLiquidationClaimed(event: LiquidationClaimed): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;
  let redemptionAmount = event.params.redemptionAmount;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  // Get asset pool contract to determine how much asset was redeemed
  let assetPoolContract = AssetPool.bind(poolAddress);
  let userPositionsCall = assetPoolContract.try_userPositions(userAddress);

  if (!userPositionsCall.reverted) {
    let assetAmount = userPositionsCall.value.getAssetAmount();
    let depositAmount = userPositionsCall.value.getDepositAmount();
    let collateralAmount = userPositionsCall.value.getCollateralAmount();
    userPosition.assetAmount = assetAmount;
    userPosition.depositAmount = depositAmount;
    userPosition.collateralAmount = collateralAmount;
    userPosition.updatedAt = event.block.timestamp;
    userPosition.save();
  }

  userRequest.requestType = "NONE"; // Reset request type
  userRequest.amount = BigInt.fromI32(0);
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for liquidation
  userRequest.requestCycle = BigInt.fromI32(0); // Reset cycle
  userRequest.updatedAt = event.block.timestamp;
  userRequest.save();

  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleLiquidationCancelled(event: LiquidationCancelled): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;

  // Find and update liquidation request
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  let userRequest = getOrCreateUserRequest(
    userAddress,
    poolAddress,
    event.block.timestamp
  );
  userRequest.requestType = "NONE"; // Reset request type
  userRequest.amount = BigInt.fromI32(0);
  userRequest.collateralAmount = BigInt.fromI32(0); // No collateral for liquidation
  userRequest.requestCycle = BigInt.fromI32(0); // Reset cycle
  userRequest.updatedAt = event.block.timestamp;
  userRequest.liquidator = null; // Clear liquidator
  userRequest.save();

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  let assetPoolContract = AssetPool.bind(poolAddress);
  let userPositionsCall = assetPoolContract.try_userPositions(userAddress);
  if (!userPositionsCall.reverted) {
    let assetAmount = userPositionsCall.value.getAssetAmount();
    let depositAmount = userPositionsCall.value.getDepositAmount();
    let collateralAmount = userPositionsCall.value.getCollateralAmount();
    userPosition.assetAmount = assetAmount;
    userPosition.depositAmount = depositAmount;
    userPosition.collateralAmount = collateralAmount;
    userPosition.updatedAt = event.block.timestamp;
    userPosition.save();
  }

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
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

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}
