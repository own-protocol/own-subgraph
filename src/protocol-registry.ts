import {
  OracleVerificationUpdated as OracleVerificationUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PoolVerificationUpdated as PoolVerificationUpdatedEvent,
  StrategyVerificationUpdated as StrategyVerificationUpdatedEvent,
} from "../generated/ProtocolRegistry/ProtocolRegistry"
import {
  OracleVerificationUpdated,
  OwnershipTransferred,
  PoolVerificationUpdated,
  StrategyVerificationUpdated,
} from "../generated/schema"

export function handleOracleVerificationUpdated(
  event: OracleVerificationUpdatedEvent,
): void {
  let entity = new OracleVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.oracle = event.params.oracle
  entity.isVerified = event.params.isVerified

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent,
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePoolVerificationUpdated(
  event: PoolVerificationUpdatedEvent,
): void {
  let entity = new PoolVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.pool = event.params.pool
  entity.isVerified = event.params.isVerified

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleStrategyVerificationUpdated(
  event: StrategyVerificationUpdatedEvent,
): void {
  let entity = new StrategyVerificationUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.strategy = event.params.strategy
  entity.isVerified = event.params.isVerified

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
