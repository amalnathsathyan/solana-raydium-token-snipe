// create-pool.ts
import {
  CREATE_CPMM_POOL_PROGRAM,
  CREATE_CPMM_POOL_FEE_ACC,
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { initSdk, txVersion } from "./config";
import dotenv from "dotenv";
dotenv.config();

// interface FeeConfig {
//   id?: string;
//   index: number;
//   // Add any other properties as required based on what `feeConfigs` returns
// }

/**
 * Creates a liquidity pool on Raydium.
 *
 * @param {string} mintAAddress - The address of the first token (mint A).
 * @param {string} mintBAddress - The address of the second token (mint B).
 * @param {BN} mintAAmount - Initial amount of mint A to add to the pool.
 * @param {BN} mintBAmount - Initial amount of mint B to add to the pool.
 * @returns {Promise<{ txId: string; poolKeys: Record<string, string> }>} - Returns transaction ID and pool keys.
 */
export const createPool = async (
  mintAAddress: string,
  mintBAddress: string,
  mintAAmount: BN,
  mintBAmount: BN
): Promise<{ txId: string; poolKeys: Record<string, string> }> => {
  const raydium = await initSdk({ loadToken: true });

  // Fetch token info from Raydium SDK
  const mintA = await raydium.token.getTokenInfo(mintAAddress);
  const mintB = await raydium.token.getTokenInfo(mintBAddress);

  const feeConfigs = await raydium.api.getCpmmConfigs();

  // Adjust fee configs for devnet
  if (raydium.cluster === "devnet") {
    feeConfigs.forEach((config) => {
      config.id = getCpmmPdaAmmConfigId(
        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
        config.index
      ).publicKey.toBase58();
    });
  }

  // Create the pool
  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount,
    mintBAmount,
    startTime: new BN(0),
    feeConfig: feeConfigs[0],
    associatedOnly: false,
    ownerInfo: {
      useSOLBalance: true,
    },
    txVersion,
    // Optional: Priority fee setup
    // computeBudgetConfig: {
    //     units: 600000,
    //     microLamports: 100000000,
    // },
  });

  // Execute transaction to create the pool
  const { txId } = await execute({ sendAndConfirm: true });
  const poolKeys = Object.keys(extInfo.address).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
    }),
    {}
  );

  console.log("Pool created successfully:", { txId, poolKeys });

  // Return the transaction ID and pool keys
  return { txId, poolKeys };
};

// Uncomment this line to test the function directly with example values
// (async () => await createPool("MINT_A_ADDRESS", "MINT_B_ADDRESS", new BN(21000000_000_000), new BN(1000_000)))();
