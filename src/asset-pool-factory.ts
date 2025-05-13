import {
  AssetOracleCreated as AssetOracleCreatedEvent,
  AssetPoolCreated as AssetPoolCreatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RegistryUpdated as RegistryUpdatedEvent,
} from "../generated/AssetPoolFactory/AssetPoolFactory";
import { Pool, Oracle } from "../generated/schema";
import { AssetPool } from "../generated/templates/AssetPool/AssetPool";
import { XToken } from "../generated/templates/XToken/XToken";
import { ERC20 } from "../generated/templates/ERC20/ERC20";
import {
  AssetPool as AssetPoolTemplate,
  XToken as XTokenTemplate,
  AssetOracle as AssetOracleTemplate,
  ERC20 as ERC20Template,
} from "../generated/templates";
import { Address, BigInt } from "@graphprotocol/graph-ts";

export function handleAssetOracleCreated(event: AssetOracleCreatedEvent): void {
  // Create a Oracle entity
  let oracle = new Oracle(event.params.oracle);
  oracle.assetSymbol = event.params.assetSymbol;
  oracle.assetPrice = BigInt.fromI32(0); // Will be updated later
  oracle.lastUpdated = BigInt.fromI32(0); // Will be updated later
  oracle.isVerified = false; // Will be set to true when  in registry
  oracle.createdAt = event.block.timestamp;
  oracle.updatedAt = event.block.timestamp;
  oracle.save();

  // Create a template for tracking the AssetOracle
  AssetOracleTemplate.create(event.params.oracle);
}

export function handleAssetPoolCreated(event: AssetPoolCreatedEvent): void {
  // Create templates for tracking the newly created contracts
  AssetPoolTemplate.create(event.params.pool);
  ERC20Template.create(event.params.depositToken);

  // Get AssetPool contract to extract additional information
  let assetPoolContract = AssetPool.bind(event.params.pool);

  // Get asset token address and other contract references
  // These might be unsuccessful calls if the contracts are not initialized properly
  let assetTokenAddress = Address.zero();
  let poolCycleManagerAddress = Address.zero();
  let poolLiquidityManagerAddress = Address.zero();
  let poolStrategyAddress = Address.zero();

  let assetTokenCall = assetPoolContract.try_assetToken();
  let poolCycleManagerCall = assetPoolContract.try_poolCycleManager();
  let poolLiquidityManagerCall = assetPoolContract.try_poolLiquidityManager();
  let poolStrategyCall = assetPoolContract.try_poolStrategy();

  if (!assetTokenCall.reverted) {
    assetTokenAddress = assetTokenCall.value;
    // Create template for XToken
    XTokenTemplate.create(assetTokenAddress);
  }

  if (!poolCycleManagerCall.reverted) {
    poolCycleManagerAddress = poolCycleManagerCall.value;
  }

  if (!poolLiquidityManagerCall.reverted) {
    poolLiquidityManagerAddress = poolLiquidityManagerCall.value;
  }

  if (!poolStrategyCall.reverted) {
    poolStrategyAddress = poolStrategyCall.value;
  }

  // Create a new Pool entity
  let pool = new Pool(event.params.pool);
  pool.assetSymbol = event.params.assetSymbol;
  pool.depositToken = event.params.depositToken;
  pool.oracle = event.params.oracle;
  pool.assetToken = assetTokenAddress;
  pool.poolCycleManager = poolCycleManagerAddress;
  pool.poolLiquidityManager = poolLiquidityManagerAddress;
  pool.poolStrategy = poolStrategyAddress;
  pool.createdAt = event.block.timestamp;
  pool.updatedAt = event.block.timestamp;
  pool.isVerified = false; // Will be set to true when verified in registry

  // Try to get token details
  let reserveToken = ERC20.bind(event.params.depositToken);
  let reserveTokenNameCall = reserveToken.try_name();
  let reserveTokenSymbolCall = reserveToken.try_symbol();
  let reserveTokenDecimalsCall = reserveToken.try_decimals();

  if (!reserveTokenNameCall.reverted) {
    pool.reserveTokenName = reserveTokenNameCall.value;
  }

  if (!reserveTokenSymbolCall.reverted) {
    pool.reserveTokenSymbol = reserveTokenSymbolCall.value;
  }

  if (!reserveTokenDecimalsCall.reverted) {
    pool.reserveTokenDecimals = reserveTokenDecimalsCall.value;
  }

  // Try to get XToken details if the address is valid
  if (assetTokenAddress != Address.zero()) {
    let xToken = XToken.bind(assetTokenAddress);
    let xTokenNameCall = xToken.try_name();
    let xTokenSymbolCall = xToken.try_symbol();
    let xTokenDecimalsCall = xToken.try_decimals();

    if (!xTokenNameCall.reverted) {
      pool.assetTokenName = xTokenNameCall.value;
    }

    if (!xTokenSymbolCall.reverted) {
      pool.assetTokenSymbol = xTokenSymbolCall.value;
    }

    if (!xTokenDecimalsCall.reverted) {
      pool.assetTokenDecimals = xTokenDecimalsCall.value;
    }
  }

  // Initialize other fields with zero values
  pool.totalSupply = BigInt.fromI32(0);
  pool.reserveBackingAsset = BigInt.fromI32(0);
  pool.totalUserDeposits = BigInt.fromI32(0);
  pool.totalUserCollateral = BigInt.fromI32(0);
  pool.totalLPLiquidityCommited = BigInt.fromI32(0);
  pool.totalLPCollateral = BigInt.fromI32(0);
  pool.cycleState = "POOL_ACTIVE";
  pool.cycleIndex = BigInt.fromI32(1);
  pool.lpCount = BigInt.fromI32(0);
  pool.currentAssetPrice = BigInt.fromI32(0);

  pool.save();

  // Update the oracle entity to establish bidirectional relationship
  let oracle = Oracle.load(event.params.oracle);
  if (oracle) {
    // Set the pool reference in the oracle
    oracle.pool = event.params.pool;
    oracle.save();
  }
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  return; // No action needed for ownership transfer
}

export function handleRegistryUpdated(event: RegistryUpdatedEvent): void {
  return; // No action needed for registry update
}
