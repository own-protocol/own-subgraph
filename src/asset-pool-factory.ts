import {
  AssetOracleCreated as AssetOracleCreatedEvent,
  AssetPoolCreated as AssetPoolCreatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RegistryUpdated as RegistryUpdatedEvent
} from "../generated/AssetPoolFactory/AssetPoolFactory"
import {
  AssetOracleCreated,
  AssetPoolCreated,
  OwnershipTransferred,
  RegistryUpdated
} from "../generated/schema"

export function handleAssetOracleCreated(event: AssetOracleCreatedEvent): void {
  let entity = new AssetOracleCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oracle = event.params.oracle
  entity.assetSymbol = event.params.assetSymbol

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleAssetPoolCreated(event: AssetPoolCreatedEvent): void {
  let entity = new AssetPoolCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.assetSymbol = event.params.assetSymbol
  entity.depositToken = event.params.depositToken
  entity.oracle = event.params.oracle

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRegistryUpdated(event: RegistryUpdatedEvent): void {
  let entity = new RegistryUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.oldRegistry = event.params.oldRegistry
  entity.newRegistry = event.params.newRegistry

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
