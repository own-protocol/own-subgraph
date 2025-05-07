import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address } from "@graphprotocol/graph-ts"
import { OracleVerificationUpdated } from "../generated/schema"
import { OracleVerificationUpdated as OracleVerificationUpdatedEvent } from "../generated/ProtocolRegistry/ProtocolRegistry"
import { handleOracleVerificationUpdated } from "../src/protocol-registry"
import { createOracleVerificationUpdatedEvent } from "./protocol-registry-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let oracle = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let isVerified = "boolean Not implemented"
    let newOracleVerificationUpdatedEvent =
      createOracleVerificationUpdatedEvent(oracle, isVerified)
    handleOracleVerificationUpdated(newOracleVerificationUpdatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("OracleVerificationUpdated created and stored", () => {
    assert.entityCount("OracleVerificationUpdated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "OracleVerificationUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "oracle",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "OracleVerificationUpdated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "isVerified",
      "boolean Not implemented"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
