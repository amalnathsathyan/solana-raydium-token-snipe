import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import fs from 'fs'
import path from 'path'
import bs58 from 'bs58'
import dotenv from 'dotenv';

dotenv.config()
// import secret from '../2vBAnVajtqmP4RBm8Vw5gzYEy3XCT9Mf1NBeQ2TPkiVF.json'
// import secret from '../2vBAnVajtqmP4RBm8Vw5gzYEy3XCT9Mf1NBeQ2TPkiVF.json'
import primaryKeypairs from '../PrimaryKeypairs.json'


// const keypairsData = JSON.parse(
//     fs.readFileSync(path.join(__dirname, 'PrimaryKeypairs.json'), 'utf8')
// );

/**
 * Selects a keypair from PrimaryKeypairs.json based on the given index.
 * @param {number} index - The index of the keypair to use.
 * @returns {Keypair} - The selected Keypair.
 */
const getOwnerByIndex = (index: number) => {
    const secret = JSON.parse(primaryKeypairs[index])
    
    console.log('Owner:', Keypair.fromSecretKey(new Uint8Array(secret)).publicKey)
    return Keypair.fromSecretKey(new Uint8Array(secret))
    // const uint8SecretArray = new Uint8Array(secret);
    //  return Keypair.fromSecretKey(uint8SecretArray);
};



let raydium: Raydium | undefined;


    

// const secret = process.env.ADMIN_KEYPAIR as string
// const secretKeyArray = JSON.parse(secret) as number[];
// console.log('secret', secret)

const endpoint = process.env.SOLANA_DEVNET_URL_HELIUS as string;
export const connection = new Connection(endpoint, 'confirmed') //<YOUR_RPC_URL>
// export const connection = new Connection(clusterApiUrl('devnet')) //<YOUR_RPC_URL>
export const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'devnet' // 'mainnet' | 'devnet'

export const initSdk = async (index:number, params?: { loadToken?: boolean }) => {
  if (raydium) return raydium
  console.log("Loading Raydium")
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
    const owner = getOwnerByIndex(index);
    console.log("Owner Pubkey", owner.publicKey)
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
    // urlConfigs: {
    //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
    // },
  })

  /**
   * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
   * if you want to handle token account by yourself, set token account data after init sdk
   * code below shows how to do it.
   * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
   */

  /*  
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

  return raydium
}

// export const fetchTokenAccountData = async () => {
//   const solAccountResp = await connection.getAccountInfo(owner.publicKey)
//   const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID })
//   const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
//   const tokenAccountData = parseTokenAccountResp({
//     owner: owner.publicKey,
//     solAccountResp,
//     tokenAccountResp: {
//       context: tokenAccountResp.context,
//       value: [...tokenAccountResp.value, ...token2022Req.value],
//     },
//   })
//   return tokenAccountData
// }