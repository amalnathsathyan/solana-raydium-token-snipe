import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

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
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  createRemoveKeyInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

import dotenv from "dotenv";
dotenv.config();

const endpoint = process.env.SOLANA_DEVNET_URL as string;
const connection = new Connection(endpoint, "confirmed");
const adminSecretKey = JSON.parse(process.env.ADMIN_KEY!);
const payer = Keypair.fromSecretKey(Uint8Array.from(adminSecretKey));
const authority = payer;
const owner = payer;
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;

const tokenMetadata: TokenMetadata = {
  updateAuthority: authority.publicKey,
  mint: mint,
  name: process.env.TOKEN_NAME || "",
  symbol: process.env.TOKEN_SYMBOL || "",
  uri: process.env.TOKEN_URI || "",
  additionalMetadata: [["", ""]],
};

const decimals = 6;
const mintAmount = Number(process.env.TOKEN_INITIAL_SUPPLY);

// Helper function to generate Solana Explorer URLs
function generateExplorerUrl(
  identifier: string,
  isAddress: boolean = false
): string {
  const baseUrl = "https://solana.fm";
  const localSuffix = "?cluster=devnet-alpha";
  const slug = isAddress ? "address" : "tx";
  return `${baseUrl}/${slug}/${identifier}${localSuffix}`;
}

export async function createTokenAndMint(): Promise<[string, string]> {
  // Calculate required space and rent-exemption for mint account
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(tokenMetadata).length;
  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataLen
  );

  // Transaction to create mint account and initialize metadata
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
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint,
      decimals,
      authority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
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
    })
  );

  // Send transaction to initialize token
  const initSig = await sendAndConfirmTransaction(connection, transaction, [
    payer,
    mintKeypair,
    authority,
  ]);

  // Create associated token account and mint tokens
  const sourceAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    owner.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );

  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    sourceAccount,
    authority,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  return [initSig, mintSig];
}

// Execute function if run as a standalone script
if (require.main === module) {
  (async () => {
    const [initSig, mintSig] = await createTokenAndMint();
    console.log(`Token created and minted:`);
    console.log(`   ${generateExplorerUrl(initSig)}`);
    console.log(`   ${generateExplorerUrl(mintSig)}`);
    console.log(`New Token:`);
    console.log(`   ${generateExplorerUrl(mint.toBase58(), true)}`);
    console.log(await getTokenMetadata(connection, mint));
  })().catch(console.error);
}
