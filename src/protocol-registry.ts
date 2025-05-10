import {
  OracleVerificationUpdated as OracleVerificationUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PoolVerificationUpdated as PoolVerificationUpdatedEvent,
  StrategyVerificationUpdated as StrategyVerificationUpdatedEvent,
} from "../generated/ProtocolRegistry/ProtocolRegistry";
import {
  OracleVerificationUpdated,
  OwnershipTransferred,
  PoolVerificationUpdated,
  StrategyVerificationUpdated,
  Pool,
  Oracle,
  Strategy,
} from "../generated/schema";
import { DefaultPoolStrategy } from "../generated/templates/DefaultPoolStrategy/DefaultPoolStrategy";
import { DefaultPoolStrategy as DefaultPoolStrategyTemplate } from "../generated/templates";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleOracleVerificationUpdated(
  event: OracleVerificationUpdatedEvent
): void {
  let entity = new OracleVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oracle = event.params.oracle;
  entity.isVerified = event.params.isVerified;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

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
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.previousOwner = event.params.previousOwner;
  entity.newOwner = event.params.newOwner;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handlePoolVerificationUpdated(
  event: PoolVerificationUpdatedEvent
): void {
  let entity = new PoolVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.pool = event.params.pool;
  entity.isVerified = event.params.isVerified;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

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
  let entity = new StrategyVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.strategy = event.params.strategy;
  entity.isVerified = event.params.isVerified;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Create or update the Strategy entity
  let strategy = Strategy.load(event.params.strategy);
  if (strategy == null) {
    strategy = new Strategy(event.params.strategy);
    strategy.createdAt = event.block.timestamp;
    strategy.isYieldBearing = false;
    DefaultPoolStrategyTemplate.create(event.params.strategy);
  }

  strategy.isVerified = event.params.isVerified;
  strategy.updatedAt = event.block.timestamp;

  // Try to get strategy details
  let strategyContract = DefaultPoolStrategy.bind(event.params.strategy);

  // Get interest rate parameters
  let interestRateParamsCall = strategyContract.try_getInterestRateParams();
  if (!interestRateParamsCall.reverted) {
    strategy.baseInterestRate = interestRateParamsCall.value.getBaseRate();
    strategy.interestRate1 = interestRateParamsCall.value.getRate1();
    strategy.maxInterestRate = interestRateParamsCall.value.getMaxRate();
    strategy.utilizationTier1 = interestRateParamsCall.value.getUtilTier1();
    strategy.utilizationTier2 = interestRateParamsCall.value.getUtilTier2();
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

  strategy.save();
}
