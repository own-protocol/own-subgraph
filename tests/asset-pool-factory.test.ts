import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address } from "@graphprotocol/graph-ts"
import { AssetOracleCreated } from "../generated/schema"
import { AssetOracleCreated as AssetOracleCreatedEvent } from "../generated/AssetPoolFactory/AssetPoolFactory"
import { handleAssetOracleCreated } from "../src/asset-pool-factory"
import { createAssetOracleCreatedEvent } from "./asset-pool-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let oracle = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let assetSymbol = "Example string value"
    let newAssetOracleCreatedEvent = createAssetOracleCreatedEvent(
      oracle,
      assetSymbol
    )
    handleAssetOracleCreated(newAssetOracleCreatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AssetOracleCreated created and stored", () => {
    assert.entityCount("AssetOracleCreated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AssetOracleCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "oracle",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "AssetOracleCreated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "assetSymbol",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
