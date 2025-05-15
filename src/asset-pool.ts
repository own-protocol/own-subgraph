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
    userPosition.collateralHealth = 3; // Start as healthy
    userPosition.createdAt = timestamp;
    userPosition.updatedAt = timestamp;
  }

  return userPosition;
}

// Helper to create or update user request
function createUserRequest(
  userAddress: Address,
  poolAddress: Address,
  requestType: string,
  amount: BigInt,
  collateralAmount: BigInt,
  requestCycle: BigInt,
  timestamp: BigInt,
  liquidator: Address | null = null
): void {
  // Get user position
  let positionId = userAddress.toHexString() + "-" + poolAddress.toHexString();
  let userPosition = UserPosition.load(positionId);

  if (userPosition != null) {
    let requestId = positionId + "-" + requestCycle.toString();
    let userRequest = new UserRequest(requestId);
    userRequest.userPosition = positionId;
    userRequest.requestType = requestType;
    userRequest.amount = amount;
    userRequest.collateralAmount = collateralAmount;
    userRequest.requestCycle = requestCycle;
    userRequest.createdAt = timestamp;
    userRequest.updatedAt = timestamp;
    userRequest.status = "PENDING";

    if (liquidator) {
      userRequest.liquidator = liquidator;
    }

    userRequest.save();
  }
}

// Helper to update pool data
function updatePoolData(poolAddress: Address, timestamp: BigInt): void {
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  let assetPoolContract = AssetPool.bind(poolAddress);

  // Update all pool metrics
  let totalUserDepositsCall = assetPoolContract.try_totalUserDeposits();
  let totalUserCollateralCall = assetPoolContract.try_totalUserCollateral();
  let reserveBackingAssetCall = assetPoolContract.try_reserveBackingAsset();
  let aggregatePoolReservesCall = assetPoolContract.try_aggregatePoolReserves();
  let cycleTotalDepositsCall = assetPoolContract.try_cycleTotalDeposits();
  let cycleTotalRedemptionsCall = assetPoolContract.try_cycleTotalRedemptions();
  let reserveYieldAccruedCall = assetPoolContract.try_reserveYieldAccrued();

  if (!totalUserDepositsCall.reverted) {
    pool.totalUserDeposits = totalUserDepositsCall.value;
  }

  if (!totalUserCollateralCall.reverted) {
    pool.totalUserCollateral = totalUserCollateralCall.value;
  }

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

  if (!reserveYieldAccruedCall.reverted) {
    pool.reserveYieldAccrued = reserveYieldAccruedCall.value;
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

// Helper to update user position health
function updateUserPositionHealth(
  userAddress: Address,
  poolAddress: Address,
  timestamp: BigInt
): void {
  let positionId = userAddress.toHexString() + "-" + poolAddress.toHexString();
  let userPosition = UserPosition.load(positionId);
  if (userPosition == null) return;

  let assetPoolContract = AssetPool.bind(poolAddress);
  let strategyAddress = assetPoolContract.poolStrategy();

  // We would call the strategy contract to get the health, but for simplicity
  // let's approximate it based on the collateral ratio
  if (userPosition.assetAmount.isZero()) {
    userPosition.collateralHealth = 3; // Healthy if no assets
  } else {
    // Calculate collateral ratio and set health
    // This is a simplified approximation - in real implementation, call the strategy contract
    let collateralRatio = userPosition.collateralAmount
      .times(BigInt.fromI32(10000))
      .div(userPosition.assetAmount);

    if (collateralRatio.ge(BigInt.fromI32(2000))) {
      // 20%
      userPosition.collateralHealth = 3; // Healthy
    } else if (collateralRatio.ge(BigInt.fromI32(1250))) {
      // 12.5%
      userPosition.collateralHealth = 2; // Warning
    } else {
      userPosition.collateralHealth = 1; // Liquidatable
    }
  }

  userPosition.updatedAt = timestamp;
  userPosition.save();
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

  // Update user position health
  updateUserPositionHealth(userAddress, poolAddress, event.block.timestamp);

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

  // Update user position health
  updateUserPositionHealth(userAddress, poolAddress, event.block.timestamp);

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

  // Get user's position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  // Create deposit request
  let assetPoolContract = AssetPool.bind(poolAddress);
  let userRequestsCall = assetPoolContract.try_userRequests(userAddress);
  let collateralAmount = BigInt.fromI32(0);

  if (!userRequestsCall.reverted) {
    collateralAmount = userRequestsCall.value.getCollateralAmount();
  }

  createUserRequest(
    userAddress,
    poolAddress,
    "DEPOSIT",
    amount,
    collateralAmount,
    cycle,
    event.block.timestamp
  );

  // Update user position values
  userPosition.depositAmount = userPosition.depositAmount.plus(amount);
  userPosition.collateralAmount =
    userPosition.collateralAmount.plus(collateralAmount);
  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

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
  userPosition.assetAmount = userPosition.assetAmount.plus(amount);
  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update user position health
  updateUserPositionHealth(userAddress, poolAddress, event.block.timestamp);

  // Update request status
  let requestId =
    userAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycle.toString();
  let userRequest = UserRequest.load(requestId);
  if (userRequest != null) {
    userRequest.status = "COMPLETED";
    userRequest.updatedAt = event.block.timestamp;
    userRequest.save();
  }

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleRedemptionRequested(event: RedemptionRequested): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let amount = event.params.assetAmount;
  let cycle = event.params.cycleIndex;

  // Update user position
  let userPosition = getOrCreateUserPosition(
    userAddress,
    poolAddress,
    event.block.timestamp
  );

  // Create redemption request
  createUserRequest(
    userAddress,
    poolAddress,
    "REDEEM",
    amount,
    BigInt.fromI32(0), // No collateral for redemption
    cycle,
    event.block.timestamp
  );

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

  // Get asset pool contract to determine how much asset was redeemed
  let assetPoolContract = AssetPool.bind(poolAddress);
  let userRequestsCall = assetPoolContract.try_userRequests(userAddress);

  if (!userRequestsCall.reverted) {
    let requestAmount = userRequestsCall.value.getAmount();
    userPosition.assetAmount = userPosition.assetAmount.minus(requestAmount);

    // Approximation of depositAmount and collateralAmount reduction
    // In a real implementation, you would calculate this more precisely
    if (
      !userPosition.depositAmount.isZero() &&
      !userPosition.assetAmount.isZero()
    ) {
      let reductionRatio = requestAmount
        .times(BigInt.fromI32(1000000))
        .div(userPosition.assetAmount.plus(requestAmount));
      let depositReduction = userPosition.depositAmount
        .times(reductionRatio)
        .div(BigInt.fromI32(1000000));
      let collateralReduction = userPosition.collateralAmount
        .times(reductionRatio)
        .div(BigInt.fromI32(1000000));

      userPosition.depositAmount =
        userPosition.depositAmount.minus(depositReduction);
      userPosition.collateralAmount =
        userPosition.collateralAmount.minus(collateralReduction);
    }
  }

  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update user position health
  updateUserPositionHealth(userAddress, poolAddress, event.block.timestamp);

  // Update request status
  let requestId =
    userAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycle.toString();
  let userRequest = UserRequest.load(requestId);
  if (userRequest != null) {
    userRequest.status = "COMPLETED";
    userRequest.updatedAt = event.block.timestamp;
    userRequest.save();
  }

  // Update pool data
  updatePoolData(poolAddress, event.block.timestamp);
}

export function handleLiquidationRequested(event: LiquidationRequested): void {
  let userAddress = event.params.user;
  let poolAddress = event.address;
  let liquidator = event.params.liquidator;
  let amount = event.params.amount;
  let cycle = event.params.cycleIndex;

  // Create liquidation request
  createUserRequest(
    userAddress,
    poolAddress,
    "LIQUIDATE",
    amount,
    BigInt.fromI32(0), // No additional collateral for liquidation
    cycle,
    event.block.timestamp,
    liquidator
  );

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
  userPosition.assetAmount = userPosition.assetAmount.minus(amount);

  // Approximation of depositAmount and collateralAmount reduction for liquidation
  if (
    !userPosition.depositAmount.isZero() &&
    !userPosition.assetAmount.isZero()
  ) {
    let reductionRatio = amount
      .times(BigInt.fromI32(1000000))
      .div(userPosition.assetAmount.plus(amount));
    let depositReduction = userPosition.depositAmount
      .times(reductionRatio)
      .div(BigInt.fromI32(1000000));
    let collateralReduction = userPosition.collateralAmount
      .times(reductionRatio)
      .div(BigInt.fromI32(1000000));

    userPosition.depositAmount =
      userPosition.depositAmount.minus(depositReduction);
    userPosition.collateralAmount =
      userPosition.collateralAmount.minus(collateralReduction);
  }

  userPosition.updatedAt = event.block.timestamp;
  userPosition.save();

  // Update user position health
  updateUserPositionHealth(userAddress, poolAddress, event.block.timestamp);

  // Find and update liquidation request
  // This is simplified - in reality you'd need to find the right request
  let pool = Pool.load(poolAddress);
  if (pool == null) return;

  let cycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1)); // Liquidation is claimed in the next cycle
  let requestId =
    userAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycleIndex.toString();
  let userRequest = UserRequest.load(requestId);

  if (userRequest != null && userRequest.requestType == "LIQUIDATE") {
    userRequest.status = "COMPLETED";
    userRequest.updatedAt = event.block.timestamp;
    userRequest.save();
  }

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

  let cycleIndex = pool.cycleIndex.minus(BigInt.fromI32(1));
  let requestId =
    userAddress.toHexString() +
    "-" +
    poolAddress.toHexString() +
    "-" +
    cycleIndex.toString();
  let userRequest = UserRequest.load(requestId);

  if (userRequest != null && userRequest.requestType == "LIQUIDATE") {
    userRequest.status = "CANCELLED";
    userRequest.updatedAt = event.block.timestamp;
    userRequest.save();
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
