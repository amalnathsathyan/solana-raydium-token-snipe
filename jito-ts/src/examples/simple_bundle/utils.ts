import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { SearcherClient } from '../../sdk/block-engine/searcher';
import { Bundle } from '../../sdk/block-engine/types';
import { isError } from '../../sdk/block-engine/utils';

const MEMO_PROGRAM_ID = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';

export const sendBundles = async (
  c: SearcherClient,
  bundleTransactionLimit: number,
  keypair: Keypair,
  conn: Connection
) => {
  const _tipAccount = (await c.getTipAccounts())[0];
  console.log('tip account:', _tipAccount);
  const tipAccount = new PublicKey(_tipAccount);

  const balance = await conn.getBalance(keypair.publicKey);
  console.log('current account has balance: ', balance);

  let isLeaderSlot = false;
  while (!isLeaderSlot) {
    const next_leader = await c.getNextScheduledLeader();
    const num_slots = next_leader.nextLeaderSlot - next_leader.currentSlot;
    isLeaderSlot = num_slots <= 2;
    console.log(`next jito leader slot in ${num_slots} slots`);
    await new Promise(r => setTimeout(r, 500));
  }

  const blockHash = await conn.getLatestBlockhash();
  const b = new Bundle([], bundleTransactionLimit);

  console.log(blockHash.blockhash);

  const bundles = [b];

  const amountSol = 0.001 * LAMPORTS_PER_SOL;

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("D4tPY74D12NQonvfRWZuESRfnDYjDVeKc6kUME555gzP"),
    lamports:amountSol,
  });

  const instructions = [transferInstruction];

  const messageV0 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockHash.blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  let maybeBundle = b.addTransactions(
    // buildMemoTransaction(keypair, new PublicKey("D4tPY74D12NQonvfRWZuESRfnDYjDVeKc6kUME555gzP"), amountSol, blockHash.blockhash),
    // buildMemoTransaction(keypair, 'jito test 2', blockHash.blockhash)
    tx
  );
  if (isError(maybeBundle)) {
    throw maybeBundle;
  }

  maybeBundle = maybeBundle.addTipTx(
    keypair,
    100_000,
    tipAccount,
    blockHash.blockhash
  );

  if (isError(maybeBundle)) {
    throw maybeBundle;
  }

  bundles.map(async b => {
    try {
      const resp = await c.sendBundle(b);
      console.log('resp:', resp);
    } catch (e) {
      console.error('error sending bundle:', e);
    }
  });
};

export const onBundleResult = (c: SearcherClient) => {
  c.onBundleResult(
    result => {
      console.log('received bundle result:', result);
    },
    e => {
      throw e;
    }
  );
};

const buildMemoTransaction = (
  keypair: Keypair,
  recipient: PublicKey,
  amountSol: number,
  recentBlockhash: string
): VersionedTransaction => {
  const lamports = amountSol * LAMPORTS_PER_SOL;

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("D4tPY74D12NQonvfRWZuESRfnDYjDVeKc6kUME555gzP"),
    lamports,
  });

  const instructions = [transferInstruction];

  const messageV0 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: recentBlockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);

  tx.sign([keypair]);

  console.log('txn signature is: ', bs58.encode(tx.signatures[0]));
  return tx;
};
