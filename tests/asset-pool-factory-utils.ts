import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  AssetOracleCreated,
  AssetPoolCreated,
  OwnershipTransferred,
  RegistryUpdated
} from "../generated/AssetPoolFactory/AssetPoolFactory"

export function createAssetOracleCreatedEvent(
  oracle: Address,
  assetSymbol: string
): AssetOracleCreated {
  let assetOracleCreatedEvent = changetype<AssetOracleCreated>(newMockEvent())

  assetOracleCreatedEvent.parameters = new Array()

  assetOracleCreatedEvent.parameters.push(
    new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle))
  )
  assetOracleCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "assetSymbol",
      ethereum.Value.fromString(assetSymbol)
    )
  )

  return assetOracleCreatedEvent
}

export function createAssetPoolCreatedEvent(
  pool: Address,
  assetSymbol: string,
  depositToken: Address,
  oracle: Address
): AssetPoolCreated {
  let assetPoolCreatedEvent = changetype<AssetPoolCreated>(newMockEvent())

  assetPoolCreatedEvent.parameters = new Array()

  assetPoolCreatedEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  assetPoolCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "assetSymbol",
      ethereum.Value.fromString(assetSymbol)
    )
  )
  assetPoolCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "depositToken",
      ethereum.Value.fromAddress(depositToken)
    )
  )
  assetPoolCreatedEvent.parameters.push(
    new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle))
  )

  return assetPoolCreatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createRegistryUpdatedEvent(
  oldRegistry: Address,
  newRegistry: Address
): RegistryUpdated {
  let registryUpdatedEvent = changetype<RegistryUpdated>(newMockEvent())

  registryUpdatedEvent.parameters = new Array()

  registryUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "oldRegistry",
      ethereum.Value.fromAddress(oldRegistry)
    )
  )
  registryUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newRegistry",
      ethereum.Value.fromAddress(newRegistry)
    )
  )

  return registryUpdatedEvent
}
