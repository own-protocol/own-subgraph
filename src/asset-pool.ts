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
  // do nothing
  return;
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
