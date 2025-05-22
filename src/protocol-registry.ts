import {
  OracleVerificationUpdated as OracleVerificationUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PoolVerificationUpdated as PoolVerificationUpdatedEvent,
  StrategyVerificationUpdated as StrategyVerificationUpdatedEvent,
} from "../generated/ProtocolRegistry/ProtocolRegistry";
import { Pool, Oracle, Strategy } from "../generated/schema";
import { DefaultPoolStrategy } from "../generated/templates/DefaultPoolStrategy/DefaultPoolStrategy";
import { DefaultPoolStrategy as DefaultPoolStrategyTemplate } from "../generated/templates";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleOracleVerificationUpdated(
  event: OracleVerificationUpdatedEvent
): void {
  // Update the Oracle entity
  let oracle = Oracle.load(event.params.oracle);
  if (oracle) {
    oracle.isVerified = event.params.isVerified;
    oracle.updatedAt = event.block.timestamp;
    oracle.save();
  }
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  return;
}

export function handlePoolVerificationUpdated(
  event: PoolVerificationUpdatedEvent
): void {
  // Update the Pool entity
  let pool = Pool.load(event.params.pool);
  if (pool) {
    pool.isVerified = event.params.isVerified;
    pool.updatedAt = event.block.timestamp;
    pool.save();
  }
}

export function handleStrategyVerificationUpdated(
  event: StrategyVerificationUpdatedEvent
): void {
  let strategyAddress = event.params.strategy;
  let strategy = Strategy.load(strategyAddress);

  // If strategy doesn't exist, create new one and fetch all data
  if (strategy == null) {
    strategy = new Strategy(strategyAddress);
    strategy.createdAt = event.block.timestamp;

    // Create template for tracking strategy events
    DefaultPoolStrategyTemplate.create(strategyAddress);

    // Initialize with default values
    strategy.isYieldBearing = false;
    strategy.baseInterestRate = BigInt.fromI32(0);
    strategy.interestRate1 = BigInt.fromI32(0);
    strategy.maxInterestRate = BigInt.fromI32(0);
    strategy.utilizationTier1 = BigInt.fromI32(0);
    strategy.utilizationTier2 = BigInt.fromI32(0);
    strategy.protocolFee = BigInt.fromI32(0);
    strategy.feeRecipient = null;
    strategy.userHealthyCollateralRatio = BigInt.fromI32(0);
    strategy.userLiquidationThreshold = BigInt.fromI32(0);
    strategy.lpHealthyCollateralRatio = BigInt.fromI32(0);
    strategy.lpLiquidationThreshold = BigInt.fromI32(0);
    strategy.lpBaseCollateralRatio = BigInt.fromI32(0);
    strategy.lpLiquidationReward = BigInt.fromI32(0);
    strategy.rebalanceLength = BigInt.fromI32(0);
    strategy.oracleUpdateThreshold = BigInt.fromI32(0);
    strategy.haltThreshold = BigInt.fromI32(0);

    // Fetch all strategy data from contract
    let strategyContract = DefaultPoolStrategy.bind(strategyAddress);

    // Get interest rate parameters
    let interestRateParamsCall = strategyContract.try_getInterestRateParams();
    if (!interestRateParamsCall.reverted) {
      strategy.baseInterestRate = interestRateParamsCall.value.getBaseRate();
      strategy.interestRate1 = interestRateParamsCall.value.getRate1();
      strategy.maxInterestRate = interestRateParamsCall.value.getMaxRate();
      strategy.utilizationTier1 = interestRateParamsCall.value.getUtilTier1();
      strategy.utilizationTier2 = interestRateParamsCall.value.getUtilTier2();
    }

    // Get cycle parameters
    let cycleParamsCall = strategyContract.try_getCycleParams();
    if (!cycleParamsCall.reverted) {
      strategy.rebalanceLength = cycleParamsCall.value.getRebalancePeriod();
      strategy.oracleUpdateThreshold =
        cycleParamsCall.value.getOracleThreshold();
      strategy.haltThreshold = cycleParamsCall.value.getPoolHaltThreshold();
    }

    // Get user collateral parameters
    let userCollateralParamsCall =
      strategyContract.try_getUserCollateralParams();
    if (!userCollateralParamsCall.reverted) {
      strategy.userHealthyCollateralRatio =
        userCollateralParamsCall.value.getHealthyRatio();
      strategy.userLiquidationThreshold =
        userCollateralParamsCall.value.getLiquidationThreshold();
    }

    // Get LP liquidity parameters
    let lpLiquidityParamsCall = strategyContract.try_getLPLiquidityParams();
    if (!lpLiquidityParamsCall.reverted) {
      strategy.lpHealthyCollateralRatio =
        lpLiquidityParamsCall.value.getHealthyRatio();
      strategy.lpLiquidationThreshold =
        lpLiquidityParamsCall.value.getLiquidationThreshold();
      strategy.lpBaseCollateralRatio =
        lpLiquidityParamsCall.value.getBaseCollateralRatio();
      strategy.lpLiquidationReward =
        lpLiquidityParamsCall.value.getLiquidationReward();
    }

    // Get protocol fee
    let protocolFeeCall = strategyContract.try_protocolFee();
    if (!protocolFeeCall.reverted) {
      strategy.protocolFee = protocolFeeCall.value;
    }

    // Get fee recipient
    let feeRecipientCall = strategyContract.try_feeRecipient();
    if (!feeRecipientCall.reverted) {
      strategy.feeRecipient = feeRecipientCall.value;
    }

    // Get yield bearing status
    let isYieldBearingCall = strategyContract.try_isYieldBearing();
    if (!isYieldBearingCall.reverted) {
      strategy.isYieldBearing = isYieldBearingCall.value;
    }
  }

  // Update verification status and timestamp
  strategy.isVerified = event.params.isVerified;
  strategy.updatedAt = event.block.timestamp;
  strategy.save();
}
