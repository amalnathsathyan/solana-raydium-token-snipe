import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
} from '@solana/web3.js';

import {
    TOKEN_2022_PROGRAM_ID,
    createInitializeMintInstruction,
    mintTo,
    createAssociatedTokenAccountIdempotent,
    AuthorityType,
    createInitializeMetadataPointerInstruction,
    TYPE_SIZE,
    LENGTH_SIZE,
    getMintLen,
    ExtensionType,
    getMint,
    getMetadataPointerState,
    getTokenMetadata,
    createSetAuthorityInstruction,
} from '@solana/spl-token';
import {
    createInitializeInstruction,
    createUpdateFieldInstruction,
    createRemoveKeyInstruction,
    pack,
    TokenMetadata,
} from '@solana/spl-token-metadata';

// create-pool.ts
import {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";

import { initSdk, txVersion } from "./cpmm.config";
import { initSdk  as  initSdkBuy} from './buy.config';

import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData, CurveCalculator } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import { isValidCpmm } from './utils'
import { NATIVE_MINT } from '@solana/spl-token'
import { printSimulateInfo } from './util'


//save your keypair file in home folder
import secret from '../2vBAnVajtqmP4RBm8Vw5gzYEy3XCT9Mf1NBeQ2TPkiVF.json'
import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.SOLANA_DEVNET_URL_HELIUS as string;
const connection = new Connection(endpoint, 'confirmed');
const admin = Keypair.fromSecretKey(new Uint8Array(secret));
const payer = admin;
const authority = admin;
const owner = admin;
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;
const mintAAddress = mint.toBase58();
let poolID;

const tokenMetadata: TokenMetadata = {
    updateAuthority: authority.publicKey,
    mint: mint,
    name: 'THE TOKEN IS RUSTY',
    symbol: 'RUSTY2',
    uri: "https://dweb.link/ipfs/Qma5VS5zQ6fGusmkDME5J68MvS9MvFMV44zkxWatUmqiQ2", // URI to a richer metadata
    additionalMetadata: [['', '']],
};

const decimals = 6;
const mintAmount = 21000000_000_000 // Supply 21M 

function generateExplorerUrl(identifier: string, isAddress: boolean = false): string {
    if (!identifier) return '';
    const baseUrl = 'https://solana.fm';
    const localSuffix = '?cluster=devnet-alpha';
    const slug = isAddress ? 'address' : 'tx';
    return `${baseUrl}/${slug}/${identifier}${localSuffix}`;
}
async function createTokenAndMint(): Promise<[string, string]> {
    // Calculate the minimum balance for the mint account
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(tokenMetadata).length;
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    // Prepare transaction
    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
            mint,
            authority.publicKey,
            mint,
            TOKEN_2022_PROGRAM_ID,
        ),
        createInitializeMintInstruction(
            mint,
            decimals,
            authority.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
        ),
        createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            metadata: mint,
            updateAuthority: authority.publicKey,
            mint: mint,
            mintAuthority: authority.publicKey,
            name: tokenMetadata.name,
            symbol: tokenMetadata.symbol,
            uri: tokenMetadata.uri,
        }),
        createUpdateFieldInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            metadata: mint,
            updateAuthority: authority.publicKey,
            field: tokenMetadata.additionalMetadata[0][0],
            value: tokenMetadata.additionalMetadata[0][1],
        }),

    );
    // Initialize Token with metadata
    const initSig = await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair, authority]);
    // Create associated token account
    const sourceAccount = await createAssociatedTokenAccountIdempotent(connection, payer, mint, owner.publicKey, {}, TOKEN_2022_PROGRAM_ID);
    // Mint Token to associated token account
    const mintSig = await mintTo(connection, payer, mint, sourceAccount, authority, mintAmount, [], undefined, TOKEN_2022_PROGRAM_ID);
    return [initSig, mintSig];
}


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
    console.log("laoding init SDK")
    const raydium = await initSdk({ loadToken: true });
    console.log("laoding init SDK sucess")
    // Fetch token info from Raydium SDK
    console.log('mintA', mintAAddress)
    console.log('mintB', mintBAddress)
    const mintA = {
        address: mintAAddress,
        programId: TOKEN_2022_PROGRAM_ID.toBase58(),
        decimals: 6,
    }
    // const mintA = await raydium.token.getTokenInfo(mintAAddress);
    console.log('mintAAfter', mintA);
    const mintB = await raydium.token.getTokenInfo('So11111111111111111111111111111111111111112');
    console.log('mintBAfter', mintB);
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


export const buy = async (amountSol: number, poolID: string, index: number) => {
    const raydium = await initSdkBuy(index, {loadToken: true})

    // SOL - USDC pool
    const poolId = poolID
    const inputAmount = new BN(amountSol * LAMPORTS_PER_SOL)
    const inputMint = NATIVE_MINT.toBase58()

    let poolInfo: ApiV3PoolInfoStandardItemCpmm
    let poolKeys: CpmmKeys | undefined
    let rpcData: CpmmRpcData

    if (raydium.cluster === 'mainnet') {
        // note: api doesn't support get devnet pool info, so in devnet else we go rpc method
        // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
        const data = await raydium.api.fetchPoolById({ ids: poolId })
        poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
        if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
        rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true)
    } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
        poolInfo = data.poolInfo
        poolKeys = data.poolKeys
        rpcData = data.rpcData
    }

    if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
        throw new Error('input mint does not match pool')

    const baseIn = inputMint === poolInfo.mintA.address

    // swap pool mintA for mintB
    const swapResult = CurveCalculator.swap(
        inputAmount,
        baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
        baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
        rpcData.configInfo!.tradeFeeRate
    )

    /**
     * swapResult.sourceAmountSwapped -> input amount
     * swapResult.destinationAmountSwapped -> output amount
     * swapResult.tradeFee -> this swap fee, charge input mint
     */

    const { execute } = await raydium.cpmm.swap({
        poolInfo,
        poolKeys,
        inputAmount,
        swapResult,
        slippage: 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
        baseIn,
        // optional: set up priority fee here
        // computeBudgetConfig: {
        //   units: 600000,
        //   microLamports: 10000000,
        // },
    })

    printSimulateInfo()
    // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
    const { txId } = await execute({ sendAndConfirm: true })
    console.log(`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`, {
        txId: `https://explorer.solana.com/tx/${txId}`,
    })
    // process.exit() // if you don't want to end up node execution, comment this line
}



(async () => {
    try {
        const [initSig, mintSig] = await createTokenAndMint();
    console.log(`Token created and minted:`);
    // console.log(`   ${generateExplorerUrl(initSig)}`);
    // console.log(`   ${generateExplorerUrl(mintSig)}`);
    // console.log(`New Token:`);
    // console.log(`   ${generateExplorerUrl(mint.toBase58(), true)}`);
    console.log(await getTokenMetadata(connection, mint));
    // const mintA = await raydium.token.getTokenInfo('6AET2G9Qqi9W8wfT6SytavhmdXPaWfBFbNVTGk8U9vNB')
    // // USDC
    // const mintB = await raydium.token.getTokenInfo('So11111111111111111111111111111111111111112')
    // const pool = await createPool(mintAAddress, "So11111111111111111111111111111111111111112", new BN(21000000_000_000), new BN(1000_000));
    const pool = await createPool(mintAAddress, "So11111111111111111111111111111111111111112", new BN(21000000_000_000), new BN(1000_000));
    poolID = await pool.poolKeys.poolId;
    const buy1Tx = await buy(0.001, poolID, 0);
    console.log("1st Primary Buy Completed", buy1Tx)
    const buy2Tx = await buy(0.003, poolID, 1);
    console.log("2nd Primary Buy Completed", buy2Tx)
    } catch (error) {
        console.log(error)
    }
})();