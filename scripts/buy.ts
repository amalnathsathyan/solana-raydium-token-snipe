import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmRpcData,
  CurveCalculator,
} from "@raydium-io/raydium-sdk-v2";
import { initSdk } from "./config";
import BN from "bn.js";
import { isValidCpmm } from "./utils";
import { NATIVE_MINT } from "@solana/spl-token";
import { printSimulateInfo } from "./util";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const buy = async (amountSol: number, poolId: string) => {
  const raydium = await initSdk();
  const inputAmount = new BN(amountSol * LAMPORTS_PER_SOL);
  const inputMint = NATIVE_MINT.toBase58();

  let poolInfo: ApiV3PoolInfoStandardItemCpmm;
  let poolKeys: CpmmKeys | undefined;
  let rpcData: CpmmRpcData;

  if (raydium.cluster === "mainnet") {
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
    if (!isValidCpmm(poolInfo.programId))
      throw new Error("Target pool is not CPMM");
    rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    rpcData = data.rpcData;
  }

  if (
    inputMint !== poolInfo.mintA.address &&
    inputMint !== poolInfo.mintB.address
  )
    throw new Error("Input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;
  const swapResult = CurveCalculator.swap(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate
  );

  const { execute } = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount,
    swapResult,
    slippage: 0.001,
    baseIn,
  });

  printSimulateInfo();
  const { txId } = await execute({ sendAndConfirm: true });
  console.log(
    `Swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}. Transaction ID: ${txId}`
  );
  return txId;
};

// Example call: buy(0.0002, '8AJp7ni8L8rfW7AQjb6txFoksSM21RxADTvxVGMh3jrw');
