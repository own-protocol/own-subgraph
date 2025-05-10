import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  AssetPool,
  CollateralDeposited,
  CollateralWithdrawn,
  DepositRequested,
  AssetClaimed,
  RedemptionRequested,
  ReserveWithdrawn,
  LiquidationRequested,
  LiquidationClaimed,
  LiquidationCancelled,
} from "../generated/templates/AssetPool/AssetPool";
import { XToken } from "../generated/templates/XToken/XToken";
import { Pool } from "../generated/schema";

export function handlePoolStateChange(
  address: Address,
  blockTimestamp: BigInt
): void {
  let pool = Pool.load(address);
  if (pool) {
    // Update from contract
    let assetPoolContract = AssetPool.bind(address);

    // Get Pool Info
    let totalUserDepositsCall = assetPoolContract.try_totalUserDeposits();
    if (!totalUserDepositsCall.reverted) {
      pool.totalUserDeposits = totalUserDepositsCall.value;
    }

    let totalUserCollateralCall = assetPoolContract.try_totalUserCollateral();
    if (!totalUserCollateralCall.reverted) {
      pool.totalUserCollateral = totalUserCollateralCall.value;
    }

    let reserveBackingAssetCall = assetPoolContract.try_reserveBackingAsset();
    if (!reserveBackingAssetCall.reverted) {
      pool.reserveBackingAsset = reserveBackingAssetCall.value;
    }

    // Get total supply from xToken
    if (pool.assetToken !== Address.zero()) {
      let xToken = XToken.bind(pool.assetToken as Address);
      let totalSupplyCall = xToken.try_totalSupply();
      if (!totalSupplyCall.reverted) {
        pool.totalSupply = totalSupplyCall.value;
      }
    }

    pool.updatedAt = blockTimestamp;
    pool.save();
  }
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleCollateralWithdrawn(event: CollateralWithdrawn): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleDepositRequested(event: DepositRequested): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleAssetClaimed(event: AssetClaimed): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleRedemptionRequested(event: RedemptionRequested): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleReserveWithdrawn(event: ReserveWithdrawn): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleLiquidationRequested(event: LiquidationRequested): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleLiquidationClaimed(event: LiquidationClaimed): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}

export function handleLiquidationCancelled(event: LiquidationCancelled): void {
  handlePoolStateChange(event.address, event.block.timestamp);
}
