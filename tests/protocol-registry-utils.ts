import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  OracleVerificationUpdated,
  OwnershipTransferred,
  PoolVerificationUpdated,
  StrategyVerificationUpdated
} from "../generated/ProtocolRegistry/ProtocolRegistry"

export function createOracleVerificationUpdatedEvent(
  oracle: Address,
  isVerified: boolean
): OracleVerificationUpdated {
  let oracleVerificationUpdatedEvent =
    changetype<OracleVerificationUpdated>(newMockEvent())

  oracleVerificationUpdatedEvent.parameters = new Array()

  oracleVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle))
  )
  oracleVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "isVerified",
      ethereum.Value.fromBoolean(isVerified)
    )
  )

  return oracleVerificationUpdatedEvent
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

export function createPoolVerificationUpdatedEvent(
  pool: Address,
  isVerified: boolean
): PoolVerificationUpdated {
  let poolVerificationUpdatedEvent =
    changetype<PoolVerificationUpdated>(newMockEvent())

  poolVerificationUpdatedEvent.parameters = new Array()

  poolVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  poolVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "isVerified",
      ethereum.Value.fromBoolean(isVerified)
    )
  )

  return poolVerificationUpdatedEvent
}

export function createStrategyVerificationUpdatedEvent(
  strategy: Address,
  isVerified: boolean
): StrategyVerificationUpdated {
  let strategyVerificationUpdatedEvent =
    changetype<StrategyVerificationUpdated>(newMockEvent())

  strategyVerificationUpdatedEvent.parameters = new Array()

  strategyVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam("strategy", ethereum.Value.fromAddress(strategy))
  )
  strategyVerificationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "isVerified",
      ethereum.Value.fromBoolean(isVerified)
    )
  )

  return strategyVerificationUpdatedEvent
}
