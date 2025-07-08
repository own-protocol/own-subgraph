import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  InterestRateParamsUpdated,
  UserCollateralParamsUpdated,
  LPLiquidityParamsUpdated,
  CycleParamsUpdated,
  FeeParamsUpdated,
  IsYieldBearingUpdated,
  HaltParamsUpdated,
} from "../generated/templates/DefaultPoolStrategy/DefaultPoolStrategy";
import { Strategy } from "../generated/schema";

export function handleInterestRateParamsUpdated(
  event: InterestRateParamsUpdated
): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.baseInterestRate = event.params.baseRate;
    strategy.interestRate1 = event.params.interestRate1;
    strategy.maxInterestRate = event.params.maxRate;
    strategy.utilizationTier1 = event.params.utilTier1;
    strategy.utilizationTier2 = event.params.utilTier2;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleUserCollateralParamsUpdated(
  event: UserCollateralParamsUpdated
): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.userHealthyCollateralRatio = event.params.healthyRatio;
    strategy.userLiquidationThreshold = event.params.liquidationRatio;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleLPLiquidityParamsUpdated(
  event: LPLiquidityParamsUpdated
): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.lpHealthyCollateralRatio = event.params.healthyRatio;
    strategy.lpLiquidationThreshold = event.params.liquidationThreshold;
    strategy.lpLiquidationReward = event.params.liquidationReward;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleCycleParamsUpdated(event: CycleParamsUpdated): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.rebalanceLength = event.params.rebalancePeriod;
    strategy.oracleUpdateThreshold = event.params.oracleUpdateThreshold;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleHaltParamsUpdated(event: HaltParamsUpdated): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.haltThreshold = event.params.haltThreshold;
    strategy.haltLiquidityPercent = event.params.haltLiquidityPercent;
    strategy.haltFeePercent = event.params.haltFeePercent;
    strategy.haltRequestThreshold = event.params.haltRequestThreshold;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleFeeParamsUpdated(event: FeeParamsUpdated): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.protocolFee = event.params.protocolFee;
    strategy.feeRecipient = event.params.feeRecipient;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}

export function handleIsYieldBearingUpdated(
  event: IsYieldBearingUpdated
): void {
  let strategyAddress = event.address;
  let strategy = Strategy.load(strategyAddress);

  if (strategy) {
    strategy.isYieldBearing = event.params.isYieldBearing;
    strategy.updatedAt = event.block.timestamp;
    strategy.save();
  }
}
